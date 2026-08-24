/* =============================================
   SPARK CONVERSATIONS LIVE v1
   Mensagem de WhatsApp que chega aparece na tela SEM F5.

   O problema (relato do cliente da conta Sócios, 24/08/2026): a mensagem que o
   Spark OS insere pela API oficial do GHL (/conversations/messages/inbound) é
   GRAVADA na hora, mas o realtime da tela deles não empurra insert de API - o
   corretor só vê depois de recarregar a página.

   O que este módulo faz: pergunta ao Spark OS, a cada 7s, se chegou mensagem
   NESTA conversa depois do instante em que ele começou a olhar. Quando chega:

     1) EMPURRÃO SUAVE primeiro - eventos de foco/visibilidade, que fazem a
        maioria das camadas de dados de SPA re-buscar sozinhas. Se pegar, o
        corretor não vê nada acontecer: a mensagem simplesmente aparece.
     2) Se não pegar em ~2,5s, um AVISO CLICÁVEL discreto no rodapé da conversa.
        Clicar atualiza. Nunca recarregamos sozinhos: recarregar apagaria o
        rascunho que o corretor está digitando.

   Nunca pede conteúdo: o sino do OS devolve só um carimbo de tempo.

   Diagnóstico (pra endurecer a v2 com dado da tela real):
       localStorage.setItem('SPARK_LIVE_DEBUG','1')
   ============================================= */
(function () {
  'use strict';

  var OS = 'https://spark-os-green.vercel.app';
  var POLL_MS = 7000;
  var NUDGE_GRACE_MS = 2500; /* quanto esperamos o empurrão suave provar que pegou */
  var DEBUG = false;
  try { DEBUG = localStorage.getItem('SPARK_LIVE_DEBUG') === '1'; } catch (e) {}

  function log() {
    if (!DEBUG) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('%c[SPARK-LIVE]', 'color:#f5b731;font-weight:bold');
    console.log.apply(console, a);
  }

  /* ── Onde estamos ──────────────────────────────────────────────────────── */
  function ctx() {
    var p = window.location.pathname;
    var loc = p.match(/\/v2\/location\/([^\/]+)/);
    /* .../conversations/conversations/<id>  (o id da conversa aberta) */
    var conv = p.match(/\/conversations\/conversations\/([^\/?#]+)/);
    return {
      locationId: loc ? loc[1] : '',
      conversationId: conv ? conv[1] : '',
    };
  }

  /* ── Estado ────────────────────────────────────────────────────────────── */
  var chaveAtual = '';   /* location:conversa que estamos observando */
  var marco = null;      /* último carimbo JÁ considerado visto */
  var avisando = false;  /* o aviso está na tela? */
  var pendente = null;   /* carimbo que disparou o empurrão em curso */
  var timer = null;

  /* ── Empurrão suave: fingir que a aba voltou ao foco ────────────────────
     Camadas de dados de SPA (incluindo as que o GHL usa) costumam re-buscar
     quando a janela volta a ficar visível. Isso é READ-ONLY: não clica em
     nada, não navega, não toca no rascunho. */
  function empurraoSuave() {
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      log('empurrão suave disparado');
    } catch (e) {
      log('empurrão suave falhou', e);
    }
  }

  /* ── Medir o painel: só pra saber se o empurrão PEGOU ────────────────────
     A tela do GHL não tem seletor público de bolha (o `_planning/
     verified-selectors.md` deste repo confirma: da conversa, o que está
     VERIFICADO é o campo de digitação `[id^="composer-input-"]`). Então em vez
     de adivinhar classe de bolha, ancoramos no que é verificado: subimos do
     campo de digitação até o painel da conversa e medimos tamanho do texto e
     número de elementos. Mensagem nova renderizada faz os dois crescerem.

     Se não acharmos o painel, a resposta é "não sei" (null) - e "não sei"
     MOSTRA o aviso. É o lado seguro do erro: um aviso a mais incomoda, uma
     mensagem invisível é o defeito que estamos consertando. */
  function painel() {
    var composer = document.querySelector('[id^="composer-input-"]');
    if (!composer) return null;
    /* Sobe até um ancestral grande o bastante pra conter a lista de mensagens
       (o composer é irmão dela). 6 níveis cobre a árvore atual com folga; a
       medição é relativa, então um ancestral a mais não atrapalha. */
    var el = composer;
    for (var i = 0; i < 6 && el.parentElement; i++) el = el.parentElement;
    return el;
  }
  function mede() {
    var p = painel();
    if (!p) { log('painel não encontrado (medição = não sei)'); return null; }
    var m = { len: (p.innerText || '').length, kids: p.querySelectorAll('*').length };
    log('medida', m);
    return m;
  }
  /* Cresceu = a tela ganhou conteúdo (a mensagem apareceu). Exige as DUAS
     medidas crescendo: só texto pode ser relógio/contador mudando. */
  function cresceu(antes, depois) {
    if (!antes || !depois) return false;
    return depois.len > antes.len && depois.kids >= antes.kids;
  }

  /* ── O aviso clicável ───────────────────────────────────────────────────── */
  function removeAviso() {
    var el = document.getElementById('spark-live-aviso');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    avisando = false;
  }

  function mostraAviso() {
    if (avisando || document.getElementById('spark-live-aviso')) return;
    avisando = true;
    var b = document.createElement('button');
    b.id = 'spark-live-aviso';
    b.type = 'button';
    b.textContent = '↓ Nova mensagem no WhatsApp, clique para atualizar';
    b.setAttribute('style', [
      'position:fixed', 'bottom:88px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483000', 'padding:9px 16px', 'border:0', 'border-radius:999px',
      'background:#0f172a', 'color:#fff', 'font:600 13px/1.2 Inter,system-ui,sans-serif',
      'box-shadow:0 6px 20px rgba(0,0,0,.28)', 'cursor:pointer',
    ].join(';'));
    b.addEventListener('click', function () {
      log('aviso clicado: atualizando');
      removeAviso();
      atualizaDeVerdade();
    });
    document.body.appendChild(b);
    log('aviso exibido');
  }

  /* ── Atualização explícita (só no clique do corretor) ────────────────────
     Tenta o caminho leve mais uma vez e, se ele não trouxer a mensagem,
     recarrega. O reload só acontece porque o corretor PEDIU ao clicar - por
     isso não há aqui a ginástica de re-navegar pelo router do GHL, que numa
     falha deixaria ele numa tela que não pediu. */
  function atualizaDeVerdade() {
    var antes = mede();
    empurraoSuave();
    setTimeout(function () {
      if (cresceu(antes, mede())) {
        log('atualizou sem recarregar');
        return;
      }
      log('recarregando a pedido do corretor');
      window.location.reload();
    }, 900);
  }

  /* ── O sino ─────────────────────────────────────────────────────────────── */
  /* Contas fora do piloto: o sino responde 403. Sem isto, TODA conta da agência
     ficaria batendo a cada 7s pra sempre pra ouvir "não". Desliga na primeira
     recusa, por conta - e volta a valer no próximo carregamento da página, que
     é o que faz o rollout ser só editar a env do OS. */
  var desligadoEm = {};

  function pergunta(c) {
    if (desligadoEm[c.locationId]) return Promise.resolve(null);
    var url = OS + '/api/integrations/wa/pulse?locationId=' + encodeURIComponent(c.locationId) +
      '&conversationId=' + encodeURIComponent(c.conversationId);
    return fetch(url, { method: 'GET', credentials: 'omit' })
      .then(function (r) {
        if (r.status === 403) {
          desligadoEm[c.locationId] = true;
          if (timer) { clearInterval(timer); timer = null; }
          log('conta fora do piloto: módulo desligado');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .catch(function () { return null; });
  }

  function rodada() {
    var c = ctx();
    if (!c.locationId || !c.conversationId) {
      if (chaveAtual) { chaveAtual = ''; marco = null; pendente = null; removeAviso(); }
      return;
    }
    var chave = c.locationId + ':' + c.conversationId;
    if (chave !== chaveAtual) {
      /* Trocou de conversa: o histórico já veio na navegação. Zeramos e o
         primeiro sino desta conversa vira o marco - só avisamos do que chegar
         DEPOIS que o corretor está olhando. */
      chaveAtual = chave;
      marco = null;
      pendente = null;
      removeAviso();
      log('conversa em foco', chave);
    }
    if (document.hidden) return; /* aba escondida: sem sino e sem aviso */

    pergunta(c).then(function (res) {
      if (!res || chaveAtual !== chave) return;
      var t = res.lastInboundAt ? Date.parse(res.lastInboundAt) : 0;
      if (!t) return;
      if (marco === null) { marco = t; log('marco inicial', res.lastInboundAt); return; }
      if (t <= marco) return;

      log('mensagem NOVA detectada', res.lastInboundAt);
      var antes = mede();
      pendente = t;
      empurraoSuave();
      setTimeout(function () {
        if (chaveAtual !== chave || pendente !== t) return;
        marco = t;
        pendente = null;
        if (cresceu(antes, mede())) {
          /* Pegou sozinho: silêncio é o melhor resultado. */
          log('empurrão suave RESOLVEU (sem aviso)');
          return;
        }
        mostraAviso();
      }, NUDGE_GRACE_MS);
    });
  }

  /* ── Ligação ────────────────────────────────────────────────────────────── */
  function liga() {
    if (timer) return;
    timer = setInterval(rodada, POLL_MS);
    rodada();
    log('ligado');
  }

  window.addEventListener('routeChangeEvent', function () { setTimeout(rodada, 400); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) rodada(); /* voltou pra aba: pergunta na hora */
  });
  liga();
})();
