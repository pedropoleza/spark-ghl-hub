/* =============================================
   SPARK SIDEBAR JS v4
   Folders, expandable sub-items, SPA-aware
   ============================================= */
(function() {
  'use strict';

  /* ── Debug interceptor (gated; logs GHL message/upload network traffic) ──
     Enable in DevTools:   localStorage.setItem('SPARK_DEBUG','1'); location.reload();
     After reproducing:    copy(JSON.stringify(window.__SPARK_CAPTURES, null, 2))
     Disable:              localStorage.removeItem('SPARK_DEBUG'); location.reload(); */
  try {
    if (localStorage.getItem('SPARK_DEBUG') === '1') {
      window.__SPARK_CAPTURES = [];
      var isInteresting = function(url) {
        return /\/(conversations\/messages|messaging\/messages|messages\/upload|media|files\/upload|attachments|sms|sendMessage)/i.test(url || '');
      };
      var serializeBody = function(body) {
        if (!body) return null;
        try {
          if (body instanceof FormData) {
            var parts = {};
            body.forEach(function(v, k) {
              parts[k] = (v && v.name !== undefined && v.size !== undefined)
                ? '[File name=' + v.name + ' size=' + v.size + 'B type=' + v.type + ']'
                : String(v).slice(0, 800);
            });
            return { type: 'FormData', parts: parts };
          }
          if (typeof body === 'string') {
            try { return { type: 'JSON', data: JSON.parse(body) }; }
            catch (e) { return { type: 'text', data: body.slice(0, 2000) }; }
          }
        } catch (e) {}
        return { type: 'other', repr: String(body).slice(0, 400) };
      };
      var capture = function(rec) {
        window.__SPARK_CAPTURES.push(rec);
        console.groupCollapsed('[SPARK-INTERCEPT] ' + rec.method + ' ' + rec.url + ' → ' + rec.status);
        console.log('Request:', rec.requestBody);
        console.log('Response:', rec.responseBody);
        console.groupEnd();
      };

      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!isInteresting(url)) return origFetch.apply(this, arguments);
        var method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
        var requestBody = serializeBody(init && init.body);
        return origFetch.apply(this, arguments).then(function(resp) {
          try {
            resp.clone().text().then(function(text) {
              var parsed;
              try { parsed = JSON.parse(text); } catch (e) { parsed = (text || '').slice(0, 2000); }
              capture({ source: 'fetch', method: method, url: url, status: resp.status, requestBody: requestBody, responseBody: parsed });
            });
          } catch (e) {}
          return resp;
        });
      };

      var XHRopen = XMLHttpRequest.prototype.open;
      var XHRsend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__sparkUrl = url; this.__sparkMethod = method;
        return XHRopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body) {
        var url = this.__sparkUrl || '';
        if (!isInteresting(url)) return XHRsend.apply(this, arguments);
        var requestBody = serializeBody(body);
        var self = this;
        this.addEventListener('load', function() {
          var parsed;
          try { parsed = JSON.parse(self.responseText); }
          catch (e) { parsed = (self.responseText || '').slice(0, 2000); }
          capture({ source: 'xhr', method: self.__sparkMethod, url: url, status: self.status, requestBody: requestBody, responseBody: parsed });
        });
        return XHRsend.apply(this, arguments);
      };

      console.log('%c[SPARK-INTERCEPT] enabled. Reproduce the action, then run: copy(JSON.stringify(window.__SPARK_CAPTURES, null, 2))', 'color:#f5b731;font-weight:bold');
    }
  } catch (e) {
    console.warn('[SPARK-INTERCEPT] init failed:', e);
  }

  /* ── 5MB → link fix (gated; enable via localStorage.setItem('SPARK_5MB_FIX','1')) ──
     GHL converts >5MB uploads into a shortlink in the message body (because it
     applies the SMS 5MB limit even when the custom WhatsApp provider is selected).
     This rewrites the outgoing draft/send: if body is *only* a shortlink and
     attachments is empty, we move the link to attachments so the custom provider
     handles it as a media attachment. */
  try {
    if (localStorage.getItem('SPARK_5MB_FIX') === '1') {
      var SHORTLINK_RX = /^https?:\/\/[^\s\/]+\/l\/[A-Za-z0-9_-]{4,}$/;
      var MSG_ENDPOINT_RX = /\/conversations\/messages(\/drafts)?(\?|$|\/)/;

      var tryFixBody = function(jsonStr) {
        var data;
        try { data = JSON.parse(jsonStr); } catch (e) { return jsonStr; }
        if (!data) return jsonStr;
        /* Drafts use "body"; the actual send uses "message" */
        var field = null;
        if (typeof data.body === 'string' && data.body) field = 'body';
        else if (typeof data.message === 'string' && data.message) field = 'message';
        if (!field) return jsonStr;
        if (data.attachments && data.attachments.length > 0) return jsonStr;
        var trimmed = data[field].trim();
        if (!SHORTLINK_RX.test(trimmed)) return jsonStr;
        data.attachments = [trimmed];
        data[field] = '';
        console.log('%c[SPARK-5MB-FIX] ' + field + ' shortlink → attachment', 'color:#3b82f6;font-weight:bold', trimmed);
        return JSON.stringify(data);
      };

      var fix_origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
        if (method.toUpperCase() === 'POST' && MSG_ENDPOINT_RX.test(url) && init && typeof init.body === 'string') {
          init = Object.assign({}, init, { body: tryFixBody(init.body) });
        }
        return fix_origFetch.call(this, input, init);
      };

      var fix_XHRopen = XMLHttpRequest.prototype.open;
      var fix_XHRsend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__spark5Url = url; this.__spark5Method = method;
        return fix_XHRopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body) {
        var url = this.__spark5Url || '';
        var method = (this.__spark5Method || '').toUpperCase();
        if (method === 'POST' && MSG_ENDPOINT_RX.test(url) && typeof body === 'string') {
          body = tryFixBody(body);
        }
        return fix_XHRsend.call(this, body);
      };

      console.log('%c[SPARK-5MB-FIX] enabled', 'color:#3b82f6;font-weight:bold');
    }
  } catch (e) {
    console.warn('[SPARK-5MB-FIX] init failed:', e);
  }

  /* ── WhatsApp · edição aplicada NA PRÓPRIA bolha (ligado por padrão) ──
     A API de Conversations do GHL não reescreve o corpo de uma mensagem (só
     status e anexos — conferido na doc). Por isso o servidor registra a edição
     como uma mensagem NOVA, com altId = "wa-edit-<idDoAlvo>-<carimbo>".
     Sem tratamento a conversa fica com duas bolhas e o texto velho continua
     valendo na original — foi o que apareceu no teste de 14/08.

     Aqui, na LEITURA da conversa, as duas viram uma: o texto novo entra na
     mensagem original (com marca de editada) e o bilhete some da thread.

     🔴 O bilhete só some quando o alvo é ACHADO. Se a original ficou fora da
     página carregada, ele fica visível de propósito — perder a edição em
     silêncio é pior que a bolha extra.

     Ver o comportamento cru:  localStorage.setItem('SPARK_WA_EDIT_RAW','1') */
  try {
    if (localStorage.getItem('SPARK_WA_EDIT_RAW') !== '1') {
      /* 🔴 NÃO estreite isto de novo. A primeira versão exigia
         "/conversations/<id>/messages" — a forma do API PÚBLICO. O app do GHL
         não chama assim (o bloco do 5MB, que funciona, casa
         "/conversations/messages"), então o dobramento simplesmente nunca
         rodava: a tela seguia com a bolha velha + o bilhete.
         Quem filtra de verdade é o corpo — `indexOf('wa-edit-')` antes de
         qualquer parse. A URL é só uma peneira grossa pra não olhar o mundo. */
      var WA_MSGS_RX = /message/i;
      var WA_DEBUG = localStorage.getItem('SPARK_WA_EDIT_DEBUG') === '1';
      /* Dois sufixos convivem, de propósito:
           nós editamos  → "wa-edit-<alvo>-<Date.now()>"   (edições repetidas)
           o contato edita → "wa-edit-<alvo>-<stanzaId>"   (id do WhatsApp, hex)
         O de trás é o id do webhook, e é ele que torna o registro idempotente
         quando o evento é reentregue — por isso NÃO exigimos dígitos aqui. O
         `(.+)` é guloso: o grupo 2 fica sempre com o ÚLTIMO trecho, mesmo se o
         alvo tiver hífen. */
      var WA_EDIT_RX = /^wa-edit-(.+)-([^-]+)$/;
      /* Quebra de linha, não espaço: assim o selo já cai EMBAIXO da mensagem
         mesmo que a camada visual abaixo não rode. É a rede — o corpo é o que
         sobrevive a qualquer re-render do GHL. */
      var WA_MARCA = '\n✏️ editada';

      /* Acha as listas de mensagens onde quer que estejam. Fixar
         `data.messages.messages` foi o segundo palpite que não colou: essa é a
         forma do API público, e o app embrulha do jeito dele. Aqui a lista é
         reconhecida pelo CONTEÚDO — array cujos itens têm `body` e `id`/`altId`. */
      var waEditListas = function (no, prof, saida) {
        if (!no || typeof no !== 'object' || prof > 4) return saida;
        if (Array.isArray(no)) {
          for (var i = 0; i < no.length; i++) {
            var it = no[i];
            if (it && typeof it === 'object' && typeof it.body === 'string' &&
                (typeof it.id === 'string' || typeof it.altId === 'string')) {
              saida.push(no);
              return saida;
            }
          }
          for (var j = 0; j < no.length && j < 50; j++) waEditListas(no[j], prof + 1, saida);
          return saida;
        }
        var ks = Object.keys(no);
        for (var k = 0; k < ks.length; k++) waEditListas(no[ks[k]], prof + 1, saida);
        return saida;
      };

      /* Dobra as edições no payload da conversa. Devolve true se mexeu.
         Idempotente: rodar de novo no mesmo objeto não muda nada. */
      var waEditAplica = function (data) {
        var listas = waEditListas(data, 0, []);
        var mexeu = false;
        for (var n = 0; n < listas.length; n++) {
          if (waEditDobra(listas[n])) mexeu = true;
        }
        if (WA_DEBUG) {
          console.log('[SPARK-WA-EDIT] listas:', listas.length,
            '| tamanhos:', listas.map(function (l) { return l.length; }).join(','),
            '| dobrou:', mexeu);
        }
        return mexeu;
      };

      /* Dobra UMA lista, no lugar (splice) — assim não precisamos saber onde ela
         mora dentro do payload. */
      var waEditDobra = function (lista) {
        if (!lista || !lista.length) return false;

        /* 1) junta os bilhetes por alvo; o carimbo mais novo vence (a mesma
              mensagem pode ser editada várias vezes) */
        var porAlvo = {};
        for (var i = 0; i < lista.length; i++) {
          var m = lista[i];
          if (!m || typeof m.altId !== 'string' || typeof m.body !== 'string') continue;
          var casou = WA_EDIT_RX.exec(m.altId);
          if (!casou) continue;
          /* o texto que passou a valer é tudo depois da primeira linha — não
             dependemos da frase do cabeçalho, que pode mudar no servidor */
          var quebra = m.body.indexOf('\n');
          if (quebra < 0) continue;
          var alvo = casou[1];
          /* Ordenar por quê: o sufixo do NOSSO lado já é o relógio; o do lado do
             contato é um stanzaId, que não ordena nada. Aí vale a data da própria
             bolha, para que a última edição do contato ganhe da anterior. */
          var carimbo = /^\d+$/.test(casou[2])
            ? Number(casou[2])
            : (Date.parse(m.dateAdded || m.dateUpdated || '') || 0);
          if (!porAlvo[alvo] || carimbo >= porAlvo[alvo].carimbo) {
            porAlvo[alvo] = { carimbo: carimbo, texto: m.body.slice(quebra + 1) };
          }
        }
        var alvos = Object.keys(porAlvo);
        if (!alvos.length) return false;

        /* 2) aplica na original. Mensagem nascida no GHL não tem altId (o alvo
              casa com o `id`); mensagem espelhada do WhatsApp casa com o altId. */
        var sumir = {};
        var mexeu = false;
        for (var a = 0; a < alvos.length; a++) {
          var alvoId = alvos[a];
          for (var j = 0; j < lista.length; j++) {
            var orig = lista[j];
            if (!orig) continue;
            if (orig.id !== alvoId && orig.altId !== alvoId) continue;
            orig.body = porAlvo[alvoId].texto + WA_MARCA;
            mexeu = true;
            /* achou o alvo → some com TODOS os bilhetes dele, não só o último */
            for (var k = 0; k < lista.length; k++) {
              var bil = lista[k];
              if (bil && typeof bil.altId === 'string' &&
                  bil.altId.indexOf('wa-edit-' + alvoId + '-') === 0) sumir[bil.id] = true;
            }
            break;
          }
        }
        if (!mexeu) {
          if (WA_DEBUG) console.log('[SPARK-WA-EDIT] bilhete sem alvo nesta lista:', alvos.join(','));
          return false;
        }

        /* remove os bilhetes NO LUGAR — de trás pra frente, pra não bagunçar o
           índice enquanto anda */
        for (var d = lista.length - 1; d >= 0; d--) {
          if (lista[d] && sumir[lista[d].id]) lista.splice(d, 1);
        }
        return true;
      };

      /* Atalho barato: sem "wa-edit-" no corpo, nem faz JSON.parse. */
      var waEditTexto = function (txt) {
        if (!txt || typeof txt !== 'string' || txt.indexOf('wa-edit-') === -1) return txt;
        var data;
        try { data = JSON.parse(txt); } catch (e) { return txt; }
        return waEditAplica(data) ? JSON.stringify(data) : txt;
      };

      /* fetch */
      var wa_origFetch = window.fetch;
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var p = wa_origFetch.apply(this, arguments);
        if (!WA_MSGS_RX.test(url)) return p;
        return p.then(function (resp) {
          if (!resp || !resp.ok) return resp;
          return resp.clone().text().then(function (txt) {
            var novo = waEditTexto(txt);
            if (novo === txt) return resp;
            /* 🔴 O corpo mudou de tamanho: content-length herdado quebra o parse,
               e se a original veio comprimida o content-encoding mente (nosso
               corpo e texto plano). Tira os dois; o resto dos headers segue. */
            var h = new Headers(resp.headers);
            h.delete('content-length');
            h.delete('content-encoding');
            return new Response(novo, {
              status: resp.status, statusText: resp.statusText, headers: h
            });
          }).catch(function () { return resp; });
        });
      };

      /* XHR (axios usa este caminho). Os getters são sombreados na INSTÂNCIA
         antes do send — se fossem instalados num listener, o handler do app já
         teria lido o valor cru primeiro. */
      var wa_XHRopen = XMLHttpRequest.prototype.open;
      var wa_XHRsend = XMLHttpRequest.prototype.send;
      var dText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
      var dResp = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__waEditUrl = url;
        return wa_XHRopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        try {
          if (WA_MSGS_RX.test(this.__waEditUrl || '') && dText && dText.get && dResp && dResp.get) {
            Object.defineProperty(this, 'responseText', {
              configurable: true,
              get: function () { return waEditTexto(dText.get.call(this)); }
            });
            Object.defineProperty(this, 'response', {
              configurable: true,
              get: function () {
                var bruto = dResp.get.call(this);
                if (typeof bruto === 'string') return waEditTexto(bruto);
                /* só objeto/array simples — Blob e ArrayBuffer passam batido.
                   toString em vez de instanceof: o payload pode vir de outro realm. */
                var tipo = Object.prototype.toString.call(bruto);
                if (tipo === '[object Object]' || tipo === '[object Array]') {
                  try { waEditAplica(bruto); } catch (e) {}
                }
                return bruto;
              }
            });
          }
        } catch (e) { /* qualquer tropeço → resposta crua, sem quebrar a tela */ }
        return wa_XHRsend.apply(this, arguments);
      };

      /* ── o selo em miúdo, no canto ──
         Sem seletor do GHL: o alvo é achado pelo PRÓPRIO texto do selo, então
         não quebra quando eles trocarem as classes.

         🔴 Nada de inserir nó aqui. Estes bloco vive dentro do React do GHL, e
         nó estranho no meio da árvore dele estoura a reconciliação (removeChild
         de nó que ele não conhece). Por isso o selo sai do texto e volta como
         ::after, que é pintura, não DOM. */
      /* Sentinela de largura ZERO: fica no texto no lugar da marca, invisível na
         tela mas detectável no código. É ela que conserta o selo fantasma: o
         React RECICLA o nó de uma mensagem editada pra outra que não é, e o
         atributo ficava colado, mostrando "editada" numa bolha que nunca foi. */
      var WA_SENTINELA = '​';
      var waSeloPassa = function () {
        if (!document.body || !document.createTreeWalker) return;
        /* 1) RESET: quem está marcado mas não tem mais a sentinela nem a marca
              crua no texto foi reciclado pra outro conteúdo → tira o selo. */
        try {
          var marcados = document.querySelectorAll('[data-spark-editada]');
          for (var m = 0; m < marcados.length; m++) {
            var el = marcados[m];
            var t = el.textContent || '';
            if (t.indexOf(WA_SENTINELA) === -1 && t.slice(-WA_MARCA.length) !== WA_MARCA) {
              el.removeAttribute('data-spark-editada');
            }
          }
        } catch (e) { /* querySelectorAll pode faltar em DOM de mentira - segue */ }
        /* 2) SET: acha a marca crua, troca pela sentinela (invisível) e marca o
              pai. A sentinela deixa o próximo passo saber que o selo continua
              valendo mesmo com o texto visível já "limpo". */
        var it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var achados = [];
        var n;
        while ((n = it.nextNode())) {
          var v = n.nodeValue;
          if (v && v.length >= WA_MARCA.length && v.slice(-WA_MARCA.length) === WA_MARCA) achados.push(n);
        }
        for (var i = 0; i < achados.length; i++) {
          var no = achados[i];
          var pai = no.parentNode;
          if (!pai || pai.nodeType !== 1) continue;
          no.nodeValue = no.nodeValue.slice(0, -WA_MARCA.length) + WA_SENTINELA;
          pai.setAttribute('data-spark-editada', '1');
        }
      };

      /* exposto pro teste (e pra reaplicar na mão no console, se precisar) */
      try { window.__SPARK_WA_SELO = waSeloPassa; } catch (e) {}

      /* O GHL re-renderiza e traz o selo de volta pro texto; a gente reaplica.
         Debounce porque a nossa própria escrita acorda o observer — na volta ele
         não acha mais nada e a coisa assenta sozinha. */
      var waSeloTimer = null;
      var waSeloAgenda = function () {
        if (waSeloTimer) return;
        waSeloTimer = setTimeout(function () {
          waSeloTimer = null;
          try { waSeloPassa(); } catch (e) {}
        }, 120);
      };
      var waSeloLiga = function () {
        try {
          if (!document.body) return;
          new MutationObserver(waSeloAgenda).observe(document.body, {
            childList: true, subtree: true, characterData: true
          });
          waSeloAgenda();
        } catch (e) { /* sem observer → o selo fica no texto, embaixo. Vive. */ }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waSeloLiga);
      } else {
        waSeloLiga();
      }
    }
  } catch (e) {
    console.warn('[SPARK-WA-EDIT] init falhou:', e);
  }

  /* ── Module loader ──
     baseURL is derived from this script's src so forks deployed elsewhere
     still load their own modules. Modules are loaded async and set globals
     the rest of this file reads via `window.__SPARK_*` (e.g. ACCOUNT_OVERRIDES).
     applySpark()'s polling cycle picks them up once available. */
  var __sparkScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('spark-sidebar.js') !== -1) return scripts[i];
    }
    return null;
  })();
  var __sparkBaseUrl = __sparkScript
    ? __sparkScript.src.replace(/spark-sidebar\.js.*$/, '')
    : 'https://dist-iota-one-53.vercel.app/';

  function loadSparkModule(name) {
    if (window['__SPARK_MODULE_LOADING_' + name]) return;
    window['__SPARK_MODULE_LOADING_' + name] = true;
    var s = document.createElement('script');
    s.src = __sparkBaseUrl + 'modules/' + name + '.js?v=1';
    s.async = true;
    document.head.appendChild(s);
  }

  /* Always load: per-account overrides (hardcoded fallback; Supabase-backed soon) */
  loadSparkModule('account-overrides');

  /* Opt-in: DOM probe + error capture for debugging */
  try {
    var __probeFlag = localStorage.getItem('SPARK_PROBE');
    if (__probeFlag === '1' || __probeFlag === 'ui') loadSparkModule('dom-probe');
  } catch (e) { /* localStorage unavailable */ }

  /* ── Config ── */
  var OTHER_TOOLS_IDS = [
    'sb_email-marketing', 'sb_payments', 'sb_sites',
    'sb_memberships', 'sb_app-media', 'sb_reputation',
    'sb_app-marketplace', 'sb_location-mobile-app'
  ];

  /* Rótulos em português do Brasil: o resto do menu é PT-BR (o cliente vê
     "Calendários", "Contatos", "Leads") e só os submenus abriam em inglês. */
  var SUB_ITEMS = {
    'sb_opportunities': [
      { label: 'Funil', path: '/opportunities/pipeline' },
      { label: 'Lista', path: '/opportunities/list' },
    ],
    'sb_contacts': [
      { label: 'Listas inteligentes', path: '/contacts/smart_list/All' },
      { label: 'Ações em massa', path: '/contacts/bulk/actions' },
    ],
    'sb_calendars': [
      { label: 'Calendário', path: '/calendars/view' },
      { label: 'Agendamentos', path: '/calendars/appointments' },
      { label: 'Configurações', path: '/settings/calendars' },
    ],
    'sb_email-marketing': [
      { label: 'Planejador social', path: '/marketing/social-planner' },
      { label: 'E-mail marketing', path: '/marketing/emails' },
    ],
    'sb_payments': [
      { label: 'Faturas', path: '/payments/invoices' },
      { label: 'Produtos', path: '/payments/products' },
      { label: 'Pedidos', path: '/payments/orders' },
    ],
    'sb_sites': [
      { label: 'Funis', path: '/funnels-websites/funnels' },
      { label: 'Sites', path: '/funnels-websites/websites' },
    ],
    'sb_automation': [
      { label: 'Fluxos de trabalho', path: '/automation/workflows' },
    ],
    'sb_reporting': [
      { label: 'Relatórios', path: '/reporting/reports' },
      { label: 'Atribuição', path: '/reporting/attribution' },
    ],
  };

  /* Account-specific overrides now live in dist/modules/account-overrides.js
     and are read from window.__SPARK_ACCOUNT_OVERRIDES at apply time. */

  var folderOpen = false;
  var expandedMenus = {};

  /* ── Helpers ── */
  function getBasePath() {
    var m = window.location.pathname.match(/\/v2\/location\/[^\/]+/);
    return m ? m[0] : '';
  }

  function getAccountId() {
    var m = window.location.pathname.match(/\/v2\/location\/([^\/]+)/);
    return m ? m[1] : '';
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ── Detect settings page ── */
  function isSettingsPage() {
    return window.location.pathname.indexOf('/settings/') !== -1;
  }

  /* ── Settings: collapsible sections ── */
  var settingsState = { 'OTHER SETTINGS': true }; /* OTHER SETTINGS collapsed by default */
  var settingsApplied = false;

  function applySettingsCollapse() {
    if (!isSettingsPage()) { settingsApplied = false; return; }
    var sidebar = document.getElementById('sidebar-v2');
    if (!sidebar) return;

    /* Settings uses hl_nav-header-without-footer, not hl_nav-header */
    var navContainer = sidebar.querySelector('.hl_nav-header-without-footer') || sidebar.querySelector('.hl_nav-header');
    if (!navContainer) return;

    /* Find all section dividers */
    var dividers = navContainer.querySelectorAll('.divider');
    if (dividers.length === 0) return;
    if (settingsApplied) return;

    dividers.forEach(function(divider) {
      var span = divider.querySelector('span.uppercase');
      if (!span || divider.querySelector('.spark-section-chevron')) return;
      var name = span.textContent.replace(/[\s\u00A0]+/g, ' ').trim();
      if (!name) return;

      var isCollapsed = settingsState[name] === true;

      /* Add chevron SVG */
      var chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chev.setAttribute('class', 'spark-section-chevron' + (isCollapsed ? ' collapsed' : ''));
      chev.setAttribute('viewBox', '0 0 24 24');
      chev.setAttribute('fill', 'none');
      chev.setAttribute('stroke', 'currentColor');
      chev.setAttribute('stroke-width', '2.5');
      chev.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
      span.appendChild(chev);

      divider.classList.add('spark-section-toggle');

      /* Get sibling items until next divider */
      var siblings = [];
      var next = divider.nextElementSibling;
      while (next && !next.classList.contains('divider')) {
        siblings.push(next);
        next = next.nextElementSibling;
      }

      /* Move Integrations into Business Services if this is Business Services */
      if (name === 'BUSINESS SERVICES') {
        var intEl = document.getElementById('sb_common.sidebar.lcIntegrations');
        if (intEl && siblings.indexOf(intEl) === -1) {
          /* Insert before the next divider */
          var lastSibling = siblings[siblings.length - 1];
          if (lastSibling && lastSibling.nextSibling) {
            lastSibling.parentNode.insertBefore(intEl, lastSibling.nextSibling);
          }
          siblings.push(intEl);
        }
      }

      /* Apply initial collapsed state */
      if (isCollapsed) {
        siblings.forEach(function(s) { s.classList.add('spark-section-hidden'); });
      }

      /* Click handler */
      divider.addEventListener('click', function(e) {
        e.stopPropagation();
        var c = divider.querySelector('.spark-section-chevron');
        var hidden = siblings[0] && siblings[0].classList.contains('spark-section-hidden');
        siblings.forEach(function(s) {
          if (hidden) s.classList.remove('spark-section-hidden');
          else s.classList.add('spark-section-hidden');
        });
        if (hidden) { c.classList.remove('collapsed'); settingsState[name] = false; }
        else { c.classList.add('collapsed'); settingsState[name] = true; }
      });
    });

    settingsApplied = true;

    /* Hide spark items that shouldn't show on settings */
    var tpl = document.getElementById('spark-templates');
    if (tpl) tpl.style.display = 'none';
    sidebar.querySelectorAll('.spark-folder-toggle, .spark-folder-body').forEach(function(el) {
      el.style.display = 'none';
    });
  }

  /* ── Main ── */
  function applySpark() {
    var sidebar = document.getElementById('sidebar-v2');
    if (!sidebar) return;
    /* On settings page, apply collapsible sections instead */
    if (isSettingsPage()) {
      applySettingsCollapse();
      return;
    }

    var nav = sidebar.querySelector('.hl_nav-header nav');
    if (!nav || nav.querySelectorAll('a').length < 3) return;
    /* Reset settings flag when leaving settings */
    settingsApplied = false;

    /* Clean previous injections */
    sidebar.querySelectorAll('[data-spark]').forEach(function(el) {
      if (el.classList.contains('spark-folder-body')) {
        while (el.firstChild) nav.appendChild(el.firstChild);
      }
      el.remove();
    });

    var base = getBasePath();

    /* ── Account-specific overrides ── */
    var accountId = getAccountId();
    var overrides = (window.__SPARK_ACCOUNT_OVERRIDES || {})[accountId];
    if (overrides) {
      sidebar.setAttribute('data-spark-account', accountId);
      if (overrides.hide) {
        overrides.hide.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
      }
      if (overrides.firstItem) {
        var firstEl = document.getElementById(overrides.firstItem) || nav.querySelector('a[id="' + overrides.firstItem + '"]');
        if (firstEl) firstEl.style.order = '0';
      }
    } else {
      sidebar.removeAttribute('data-spark-account');
    }

    /* ── Inject Templates link ── */
    if (!document.getElementById('spark-templates')) {
      var tpl = document.createElement('a');
      tpl.id = 'spark-templates';
      tpl.href = base + '/conversations/templates?tab=folders&page=1&size=20';
      tpl.setAttribute('data-spark', '1');
      tpl.className = 'w-full group px-3 flex items-center justify-start lg:justify-start xl:justify-start text-sm font-medium rounded-md cursor-pointer py-2 md:py-2';
      tpl.innerHTML = '<span class="h-5 w-5 mr-2 lg:mr-2 xl:mr-2" style="display:inline-flex;align-items:center;justify-content:center;"><i class="fas fa-file-alt" style="font-size:15px"></i></span><span class="hl_text-overflow sm:hidden md:hidden nav-title lg:block xl:block">Templates</span>';
      /* Only active if on templates page */
      if (window.location.pathname.match(/\/conversations\/templates(\/|$)/)) {
        tpl.classList.add('spark-active');
        /* Remove active from Conversations since we're on templates sub-page */
        var convEl = document.getElementById('sb_conversations');
        if (convEl) {
          convEl.classList.remove('active', 'exact-active');
        }
      }
      tpl.addEventListener('click', function(e) {
        e.preventDefault();
        /* Mark as active immediately */
        tpl.classList.add('spark-active');
        var convEl = document.getElementById('sb_conversations');
        if (convEl) convEl.classList.remove('active', 'exact-active');
        /* Navigate */
        try {
          var app = document.getElementById('app');
          if (app && app.__vue_app__) {
            var router = app.__vue_app__.config.globalProperties.$router;
            if (router) { router.push(base + '/conversations/templates?tab=folders&page=1&size=20'); return; }
          }
          if (app && app.__vue__ && app.__vue__.$router) {
            app.__vue__.$router.push(base + '/conversations/templates?tab=folders&page=1&size=20'); return;
          }
        } catch(err) {}
        window.location.assign(base + '/conversations/templates?tab=folders&page=1&size=20');
      });
      nav.appendChild(tpl);
    }

    /* ── Inject "Other Tools" folder ── */
    var toggle = document.createElement('div');
    toggle.className = 'spark-folder-toggle';
    toggle.setAttribute('data-spark', '1');
    toggle.style.order = '20';
    toggle.innerHTML = '<svg class="spark-folder-chevron' + (folderOpen ? ' open' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg><span class="spark-folder-label">Outras ferramentas</span>';

    var body = document.createElement('div');
    body.className = 'spark-folder-body' + (folderOpen ? '' : ' collapsed');
    body.setAttribute('data-spark', '1');
    body.style.order = '21';

    toggle.addEventListener('click', function() {
      folderOpen = !folderOpen;
      var chev = toggle.querySelector('.spark-folder-chevron');
      if (folderOpen) { body.classList.remove('collapsed'); chev.classList.add('open'); }
      else { body.classList.add('collapsed'); chev.classList.remove('open'); }
    });

    nav.appendChild(toggle);

    OTHER_TOOLS_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) body.appendChild(el);
    });

    nav.appendChild(body);

    /* ── Inject expandable sub-items ── */
    Object.keys(SUB_ITEMS).forEach(function(parentId) {
      var parentEl = document.getElementById(parentId);
      if (!parentEl) return;

      var subs = SUB_ITEMS[parentId];
      var isOpen = !!expandedMenus[parentId];

      /* Add expand button inside the <a> */
      var existing = parentEl.querySelector('.spark-expand-btn');
      if (!existing) {
        var btn = document.createElement('button');
        btn.className = 'spark-expand-btn' + (isOpen ? ' open' : '');
        btn.setAttribute('data-spark', '1');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          expandedMenus[parentId] = !expandedMenus[parentId];
          var submenu = parentEl.nextElementSibling;
          if (submenu && submenu.classList.contains('spark-submenu')) {
            if (expandedMenus[parentId]) { submenu.classList.remove('collapsed'); btn.classList.add('open'); }
            else { submenu.classList.add('collapsed'); btn.classList.remove('open'); }
          }
        });
        parentEl.style.position = 'relative';
        parentEl.appendChild(btn);
      }

      /* Create submenu div right after the parent <a> */
      var subId = 'spark-sub-' + parentId;
      var existingSub = document.getElementById(subId);
      if (existingSub) existingSub.remove();

      var submenu = document.createElement('div');
      submenu.id = subId;
      submenu.className = 'spark-submenu' + (isOpen ? '' : ' collapsed');
      submenu.setAttribute('data-spark', '1');
      submenu.style.order = parentEl.style.order || getComputedStyle(parentEl).order;

      var currentPath = window.location.pathname;

      subs.forEach(function(sub) {
        var a = document.createElement('a');
        a.href = base + sub.path;
        a.textContent = sub.label;
        if (currentPath.indexOf(sub.path) !== -1) a.classList.add('spark-sub-active');
        a.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          /* Navigate via GHL's Vue Router by finding the app's router instance */
          var fullPath = base + sub.path;
          try {
            /* Try Vue Router push via the app instance */
            var app = document.getElementById('app');
            if (app && app.__vue_app__) {
              var router = app.__vue_app__.config.globalProperties.$router;
              if (router) {
                router.push(fullPath);
                return;
              }
            }
            /* Fallback: try __vue__ on app */
            if (app && app.__vue__ && app.__vue__.$router) {
              app.__vue__.$router.push(fullPath);
              return;
            }
          } catch(err) {}
          /* Last fallback: soft navigation via location assign (still better than href) */
          window.location.assign(fullPath);
        });
        submenu.appendChild(a);
      });

      /* Insert after parent */
      if (parentEl.nextSibling) {
        parentEl.parentNode.insertBefore(submenu, parentEl.nextSibling);
      } else {
        parentEl.parentNode.appendChild(submenu);
      }
    });
  }

  /* ── Persistent observer — watches for nav changes and re-applies ── */
  var lastApplied = 0;

  function checkAndApply() {
    var now = Date.now();
    if (now - lastApplied < 500) return; /* debounce */

    /* Settings page — check if sections need collapsing */
    if (isSettingsPage()) {
      if (!settingsApplied) {
        lastApplied = now;
        applySettingsCollapse();
      }
      /* Always hide spark items on settings */
      var tpl = document.getElementById('spark-templates');
      if (tpl) tpl.style.display = 'none';
      document.querySelectorAll('.spark-folder-toggle, .spark-folder-body, .spark-submenu').forEach(function(el) {
        el.style.display = 'none';
      });
      return;
    }

    var nav = document.querySelector('#sidebar-v2 .hl_nav-header nav');
    if (!nav || nav.querySelectorAll('a').length < 5) return;
    /* Check if our folder is missing (GHL re-rendered) */
    var hasFolder = nav.querySelector('[data-spark]');
    if (!hasFolder) {
      lastApplied = now;
      applySpark();
    }
    /* Sync Templates active state */
    syncTemplatesActive();
    /* Hide "Send a Review Request" from Quick Actions */
    hideReviewRequest();
  }

  function hideReviewRequest() {
    /* Handled by CSS: #quick-send-review-v2 { display: none } */
  }

  function syncTemplatesActive() {
    var tpl = document.getElementById('spark-templates');
    if (!tpl) return;
    var onTemplates = window.location.pathname.match(/\/conversations\/templates(\/|$)/);
    if (onTemplates) {
      tpl.classList.add('spark-active');
      var convEl = document.getElementById('sb_conversations');
      if (convEl) convEl.classList.remove('active', 'exact-active');
    } else {
      tpl.classList.remove('spark-active');
    }
  }

  /* Persistent poll every 1.5s — catches ALL re-renders including Settings back */
  setInterval(checkAndApply, 1500);

  /* Also watch DOM mutations for faster response */
  var obs = new MutationObserver(function() { checkAndApply(); });
  obs.observe(document.body, { childList: true, subtree: true });

  /* Route change backup */
  window.addEventListener('routeChangeEvent', function() {
    setTimeout(checkAndApply, 300);
    setTimeout(checkAndApply, 800);
    setTimeout(checkAndApply, 2000);
  });

  /* Initial */
  setTimeout(checkAndApply, 500);

  /* ── Load Onboarding Widget (v3 — re-skin teal Spark OS + fluxo Victor) ── */
  var obScript = document.createElement('script');
  obScript.src = __sparkBaseUrl + 'spark-onboarding.js?v=22';
  document.head.appendChild(obScript);

  /* ── Load Zoom Connect module (sidebar link "Resumos IA" + connect wizard) ── */
  var zoomScript = document.createElement('script');
  zoomScript.src = __sparkBaseUrl + 'spark-zoom.js?v=1';
  document.head.appendChild(zoomScript);

})();
