/* Exercita o bundle REAL (dist/spark-sidebar.js) num DOM de mentira.
   Só interessa o bloco SPARK-WA-EDIT: o resto pode tropeçar à vontade. */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CODIGO = readFileSync(
  new URL("../dist/spark-sidebar.js", import.meta.url),
  "utf8",
);

const store = {};
const noop = () => {};
const elemento = () => ({
  style: {}, classList: { add: noop, remove: noop, contains: () => false },
  addEventListener: noop, appendChild: noop, querySelector: () => null,
  querySelectorAll: () => [], setAttribute: noop, getAttribute: () => null,
  remove: noop, insertBefore: noop, children: [], parentNode: null,
});

const janela = {
  /* o bundle captura este fetch como "original"; ele delega pro caso do teste */
  fetch: (...a) => janela.__orig(...a),
  Response, Request, Headers, XMLHttpRequest: class {},
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  location: { pathname: "/", href: "https://app.sparkleads.pro/" },
  addEventListener: noop, setInterval: noop, setTimeout: noop, console,
  MutationObserver: class { observe() {} disconnect() {} },
  NodeFilter: { SHOW_TEXT: 4 },
  document: {
    currentScript: { src: "https://x/spark-sidebar.js" },
    getElementsByTagName: () => [], querySelector: () => null, querySelectorAll: () => [],
    createElement: elemento, head: elemento(), body: elemento(), addEventListener: noop,
    readyState: "complete",
  },
};
janela.window = janela;
janela.globalThis = janela;
janela.self = janela;

/* XMLHttpRequest de mentira com os getters de protótipo que o bundle sombreia */
class XHRFake {
  open(m, u) { this.__m = m; this.__u = u; }
  send() { this.__enviou = true; }
}
Object.defineProperty(XHRFake.prototype, "responseText", { configurable: true, get() { return this.__raw; } });
Object.defineProperty(XHRFake.prototype, "response", { configurable: true, get() { return this.__obj !== undefined ? this.__obj : this.__raw; } });
janela.XMLHttpRequest = XHRFake;

const ctx = vm.createContext(janela);
try {
  vm.runInContext(CODIGO, ctx);
} catch (e) {
  /* o resto do bundle é DOM — tropeço aqui é esperado */
  if (String(e).indexOf("SPARK-WA-EDIT") !== -1) throw e;
}

/* ---------- casos ---------- */
const NOTA = (alvo, carimbo, texto) => ({
  id: "nota-" + carimbo, altId: `wa-edit-${alvo}-${carimbo}`, direction: "outbound",
  body: `✏️ Mensagem editada no WhatsApp — passou a valer:\n${texto}`,
});
const payload = (msgs) => ({ messages: { messages: msgs, lastMessageId: "x" }, traceId: "t" });

let falhas = 0;
const ok = (nome, cond, extra) => {
  if (cond) console.log("  ok  ", nome);
  else { falhas++; console.log("  FALHOU", nome, extra !== undefined ? JSON.stringify(extra) : ""); }
};

async function via(body) {
  janela.__orig = async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const resp = await ctx.fetch("https://services.leadconnectorhq.com/conversations/abc/messages?limit=20");
  return JSON.parse(await resp.text());
}

/* o fetch original precisa existir ANTES do bundle embrulhar — refaz o embrulho */
console.log("\n1) caso do Pedro: mensagem do GHL (sem altId) editada no WhatsApp");
{
  const orig = { id: "6R4XzWzw9kr4kX1ZmaU5", altId: null, direction: "outbound", body: "teste" };
  const d = await via(payload([NOTA("6R4XzWzw9kr4kX1ZmaU5", 1786680633590, "teste 2"), orig]));
  const l = d.messages.messages;
  ok("sobra uma bolha só", l.length === 1, l.length);
  ok("texto novo na original", l[0] && l[0].body === "teste 2\n✏️ editada", l[0] && l[0].body);
  ok("id preservado", l[0] && l[0].id === "6R4XzWzw9kr4kX1ZmaU5");
}

console.log("\n2) mensagem espelhada do WhatsApp (casa por altId)");
{
  const orig = { id: "ghl-1", altId: "3A77A3EE", direction: "inbound", body: "amor" };
  const d = await via(payload([NOTA("3A77A3EE", 111, "amor mesmo"), orig]));
  const l = d.messages.messages;
  ok("dobrou", l.length === 1 && l[0].body === "amor mesmo\n✏️ editada", l.map((m) => m.body));
}

console.log("\n3) editada DUAS vezes — vale a última, e os dois bilhetes somem");
{
  const orig = { id: "m1", altId: null, direction: "outbound", body: "v1" };
  const d = await via(payload([NOTA("m1", 200, "v3"), NOTA("m1", 100, "v2"), orig]));
  const l = d.messages.messages;
  ok("sobra uma", l.length === 1, l.length);
  ok("venceu a mais nova", l[0].body === "v3\n✏️ editada", l[0].body);
}

console.log("\n4) original fora da página — o bilhete FICA (nada some em silêncio)");
{
  const outra = { id: "outra", altId: null, direction: "inbound", body: "oi" };
  const d = await via(payload([NOTA("sumida", 300, "novo texto"), outra]));
  const l = d.messages.messages;
  ok("bilhete preservado", l.length === 2, l.length);
  ok("bilhete intacto", l.some((m) => m.altId === "wa-edit-sumida-300"));
}

console.log("\n5) conversa sem edição nenhuma — passa incólume");
{
  const msgs = [{ id: "a", altId: "x", direction: "inbound", body: "oi" }, { id: "b", altId: "y", direction: "outbound", body: "olá" }];
  const d = await via(payload(msgs));
  ok("intacta", JSON.stringify(d.messages.messages) === JSON.stringify(msgs));
}

console.log("\n6) resposta não-JSON não quebra");
{
  janela.__orig = async () => new Response("<html>erro</html>", { status: 200 });
  const resp = await ctx.fetch("https://x/conversations/abc/messages");
  ok("devolve o corpo cru", (await resp.text()) === "<html>erro</html>");
}

console.log("\n7) XHR: responseText sai dobrado");
{
  const x = new ctx.XMLHttpRequest();
  x.open("GET", "https://services.leadconnectorhq.com/conversations/abc/messages");
  x.send();
  x.__raw = JSON.stringify(payload([NOTA("m9", 1, "editado"), { id: "m9", altId: null, body: "cru", direction: "outbound" }]));
  const saida = JSON.parse(x.responseText);
  ok("dobrou no XHR", saida.messages.messages.length === 1 && saida.messages.messages[0].body === "editado\n✏️ editada", saida.messages.messages.map((m) => m.body));
}

console.log("\n8) XHR responseType json: objeto mutado no lugar, e idempotente");
{
  const x = new ctx.XMLHttpRequest();
  x.open("GET", "https://services.leadconnectorhq.com/conversations/abc/messages");
  x.send();
  x.__obj = payload([NOTA("m8", 1, "novo"), { id: "m8", altId: null, body: "velho", direction: "outbound" }]);
  const a = x.response;
  const primeiro = JSON.stringify(a.messages.messages);
  const b = x.response;
  ok("dobrou", a.messages.messages.length === 1 && a.messages.messages[0].body === "novo\n✏️ editada", a.messages.messages.map((m) => m.body));
  ok("ler de novo não muda nada", JSON.stringify(b.messages.messages) === primeiro, b.messages.messages.map((m) => m.body));
}

/* O contato editando no celular vem por outro caminho (inbound.ts), e o sufixo
   ali é o stanzaId do WhatsApp — hex, não relógio. Exigir dígitos deixava esta
   thread com a bolha velha + o bilhete: o mesmo defeito, do outro lado. */
console.log("\n10) contato editou no celular — sufixo é stanzaId, não carimbo");
{
  const nota = {
    id: "nota-hex", altId: "wa-edit-3A77A3EE-3EB0C767D26B8F3A1B2C", direction: "inbound",
    body: "✏️ Mensagem editada no WhatsApp — passou a valer:\namor mesmo",
  };
  const orig = { id: "ghl-9", altId: "3A77A3EE", direction: "inbound", body: "amor" };
  const l = (await via(payload([nota, orig]))).messages.messages;
  ok("dobrou", l.length === 1, l.length);
  ok("texto novo na original", l[0] && l[0].body === "amor mesmo\n✏️ editada", l[0] && l[0].body);
}

console.log("\n11) contato editou DUAS vezes — desempata pela data da bolha");
{
  const nota = (id, quando, texto) => ({
    id, altId: `wa-edit-3B00FF-${id}`, direction: "inbound", dateAdded: quando,
    body: `✏️ Mensagem editada no WhatsApp — passou a valer:\n${texto}`,
  });
  const orig = { id: "ghl-10", altId: "3B00FF", direction: "inbound", body: "v1" };
  /* a mais nova vem ANTES na lista: sem a data, a ordem do array decidiria errado */
  const l = (await via(payload([
    nota("AAAA", "2026-08-14T03:00:00.000Z", "v3"),
    nota("BBBB", "2026-08-14T02:00:00.000Z", "v2"),
    orig,
  ]))).messages.messages;
  ok("sobra uma", l.length === 1, l.length);
  ok("venceu a mais nova", l[0] && l[0].body === "v3\n✏️ editada", l[0] && l[0].body);
}

/* Os dois palpites que reprovaram na tela do Pedro: a FORMA DA URL e a FORMA DO
   PAYLOAD, ambas copiadas do API público. O app do GHL não usa nenhuma das duas.
   Estes dois casos existem pra não estreitar de novo. */
async function viaUrl(url, body) {
  janela.__orig = async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  return JSON.parse(await (await ctx.fetch(url)).text());
}

console.log("\n12) URL do app real (/conversations/messages, sem id no meio)");
{
  const orig = { id: "m12", altId: null, direction: "outbound", body: "teste" };
  const corpo = payload([NOTA("m12", 1786680633590, "teste 2"), orig]);
  const l = (await viaUrl("https://services.leadconnectorhq.com/conversations/messages?conversationId=abc&limit=20", corpo)).messages.messages;
  ok("dobrou na URL do app", l.length === 1 && l[0].body === "teste 2\n✏️ editada", l.map((m) => m.body));
}

console.log("\n13) payload embrulhado de outro jeito — acha a lista pelo conteúdo");
{
  const orig = { id: "m13", altId: null, direction: "outbound", body: "v1" };
  /* nem `messages.messages`, nem `messages`: fundo de um embrulho qualquer */
  const corpo = { data: { thread: { items: [NOTA("m13", 1786680633590, "v2"), orig] } } };
  const d = await viaUrl("https://x/conversations/messages", corpo);
  const l = d.data.thread.items;
  ok("dobrou fora da forma conhecida", l.length === 1 && l[0].body === "v2\n✏️ editada", l.map((m) => m.body));
}

/* O selo em miúdo roda DENTRO do React do GHL. Nó inserido no meio da árvore
   dele estoura a reconciliação, então a regra é: mexe no texto, marca o
   elemento, e NUNCA cria nó. É isto que este caso tranca. */
const SENT = "​"; // a sentinela invisível (zero-width space) que o bundle usa
function domSelo() {
  // DOM de mentira que reflete parent.textContent do filho de texto e um
  // querySelectorAll('[data-spark-editada]') de verdade sobre os elementos vivos.
  let inseriu = false;
  const registro = [];
  const pai = (nome) => {
    const el = {
      nodeType: 1, __nome: nome, attrs: {}, _text: null,
      get textContent() { return this._text ? this._text.nodeValue : ""; },
      setAttribute(k, v) { this.attrs[k] = v; },
      removeAttribute(k) { delete this.attrs[k]; },
      appendChild() { inseriu = true; }, insertBefore() { inseriu = true; },
      replaceChild() { inseriu = true; }, removeChild() { inseriu = true; },
    };
    registro.push(el);
    return el;
  };
  const texto = (v, p) => { const t = { nodeType: 3, nodeValue: v, parentNode: p }; p._text = t; return t; };
  const walker = (nos) => () => { let i = 0; return { nextNode: () => (i < nos.length ? nos[i++] : null) }; };
  janela.document.querySelectorAll = () => registro.filter((e) => "data-spark-editada" in e.attrs);
  return { pai, texto, walker, marcou: () => inseriu, janela };
}

console.log("\n14) selo vira ::after — texto vira sentinela, atributo posto, nenhum nó criado");
{
  const d = domSelo();
  const bolha = d.pai("bolha");
  const outra = d.pai("outra");
  const nos = [d.texto("teste 2\n✏️ editada", bolha), d.texto("mensagem comum", outra)];
  janela.document.body = d.pai("body");
  janela.document.createTreeWalker = d.walker(nos);

  ctx.window.__SPARK_WA_SELO();

  ok("marca crua saiu do texto", nos[0].nodeValue === "teste 2" + SENT, JSON.stringify(nos[0].nodeValue));
  ok("elemento marcado", bolha.attrs["data-spark-editada"] === "1", bolha.attrs);
  ok("🔴 nenhum nó criado (React intacto)", d.marcou() === false);
  ok("bolha sem selo não é tocada", nos[1].nodeValue === "mensagem comum" && !("data-spark-editada" in outra.attrs));
}

console.log("\n15) 🔴 selo fantasma: nó reciclado pelo React perde o selo no próximo passo");
{
  const d = domSelo();
  const bolha = d.pai("bolha");
  const nos = [d.texto("v2\n✏️ editada", bolha)];
  janela.document.body = d.pai("body");
  janela.document.createTreeWalker = d.walker(nos);
  ctx.window.__SPARK_WA_SELO();
  ok("marcado no 1o passo", bolha.attrs["data-spark-editada"] === "1", bolha.attrs);
  ok("idempotente: reler não duplica sentinela", (() => { ctx.window.__SPARK_WA_SELO(); return nos[0].nodeValue === "v2" + SENT; })(), JSON.stringify(nos[0].nodeValue));
  // React RECICLA a bolha pra uma mensagem que NÃO foi editada:
  nos[0].nodeValue = "mensagem nova, nao editada";
  ctx.window.__SPARK_WA_SELO();
  ok("selo removido do nó reciclado", !("data-spark-editada" in bolha.attrs), bolha.attrs);
}

console.log("\n9) URL que não é de mensagens passa reto");
{
  janela.__orig = async () => new Response(JSON.stringify({ wa: "wa-edit-nada" }), { status: 200 });
  const resp = await ctx.fetch("https://x/contacts/abc");
  ok("intocada", (await resp.text()).indexOf("wa-edit-nada") !== -1);
}

console.log(falhas === 0 ? "\n✅ tudo passou" : `\n❌ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
