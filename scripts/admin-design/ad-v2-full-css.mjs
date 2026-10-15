// /admin v2 COMPLETE — styles. Celeste tokens come from partidos-gen/tokens.css (artboard()).
// Quiet utility chrome; the signature objects (peg wall, LED scoreboard, vitrina, cromo, lower thirds) only at the peaks.
// The design source of src/styles/admin.css, kept in the repo so `node scripts/port-admin-css.mjs` can
// regenerate it: the canvas CSS plus the rules the app added since (.pad.mas, .pzc, .lst, .rdrs a). It
// still names the results as the canvas does (.ved.V / .ved.E / .ved.D); the port writes G·E·P.
export const css = String.raw`
.v2f{--red:#ff6b61;--amber:#ffb547;--panel:rgba(255,255,255,.035);--panel2:rgba(255,255,255,.06);--pline:rgba(255,255,255,.09);--deep:#050b1f;--shirt:#a9d6f5;--led:#cfe8ff;--glass:rgba(159,208,242,.08);
--wall:linear-gradient(180deg,#0d1a3c,#08132f 60%,#060d24);--wall-line:rgba(255,255,255,.07);--railbar:linear-gradient(180deg,#3a5a8c,#1c2f57);--pegdot:#9fb3d3;--sheet:#0a1532;--pop:#0b1634;--scrim:rgba(2,5,14,.62);--stick:#060d24;
position:relative;overflow:hidden;font-size:15px;line-height:1.4;color:var(--ink);background:radial-gradient(70% 50% at 70% 0%,#0f2350 0%,#050b1f 60%,#030817 100%)}
.v2f[data-theme=light]{--red:#c0392b;--amber:#8a5600;--panel:rgba(255,255,255,.72);--panel2:#fff;--pline:rgba(12,23,51,.12);--deep:#0c1733;--glass:rgba(42,115,173,.08);
--wall:linear-gradient(180deg,#dbe8f5,#cbdcee);--wall-line:rgba(12,23,51,.05);--railbar:linear-gradient(180deg,#8fa9c8,#6a86aa);--pegdot:#4f6a90;--sheet:#f4f8fc;--pop:#ffffff;--scrim:rgba(12,23,51,.35);--stick:#e6eef7;background:#eef4fa}
.v2f h1,.v2f h2,.v2f h3,.v2f p{margin:0}
:where(.v2f) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
.v2f input,.v2f textarea{font:inherit;color:var(--ink)}
.v2f .ttl{font-family:'Anybody';font-weight:900;font-variation-settings:'wdth' 112;letter-spacing:-.01em;line-height:1}
.v2f .mono{font-family:'Geist Mono';font-size:13px;letter-spacing:.02em}
.v2f .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.v2f .btn{min-height:44px;padding:0 18px;border-radius:999px;background:var(--ghost);color:var(--ghost-ink);font-weight:600;font-size:15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;text-decoration:none}
.v2f .btn.line{background:transparent;box-shadow:inset 0 0 0 1.5px var(--pline);color:var(--ink)}
.v2f .btn.sky{background:var(--pill-on);color:var(--pill-on-ink)}
.v2f .btn.gold{background:var(--cta);color:var(--cta-ink);box-shadow:var(--cta-shadow);font-weight:700}
.v2f .btn.red{background:transparent;color:var(--red);box-shadow:inset 0 0 0 1.5px var(--red)}
.v2f .btn.redf{background:#d6332b;color:#fff}
.v2f .btn.sm{min-height:40px;padding:0 14px;font-size:14px}
.v2f .btn.xl{min-height:54px;padding:0 24px;font-size:17px}
.v2f .btn[disabled]{opacity:.55;box-shadow:none;cursor:not-allowed}
.v2f .btn.gold[disabled]{opacity:1;background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1.5px var(--pline)}
.v2f .lnk{color:var(--accent);font-weight:600;display:inline-flex;align-items:center;gap:6px;min-height:40px}
.ved{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;font-family:'Anybody';font-weight:900;font-size:13px;flex:0 0 auto;line-height:1}
.ved.V{background:#6CABDD;color:#0c1733}.ved.E{box-shadow:inset 0 0 0 1.5px var(--soft);color:var(--ink)}.ved.D{box-shadow:inset 0 0 0 1.5px var(--muted);color:var(--muted);background:repeating-linear-gradient(135deg,transparent 0 3px,rgba(159,179,211,.18) 3px 5px)}
.ved.sm{width:20px;height:20px;font-size:12px;border-radius:6px}
.ved.o{box-shadow:inset 0 0 0 1.5px var(--pline);background:none;color:var(--muted)}
.warn{display:inline-flex;align-items:center;gap:6px;color:var(--amber);font-weight:600;font-size:14px}
.bad{display:inline-flex;align-items:center;gap:6px;color:var(--red);font-weight:600;font-size:14px}
.okk{display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:600;font-size:14px}
.tag{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap}
.tag.am{background:rgba(255,181,71,.14);color:var(--amber)}
.tag.rd{background:rgba(255,107,97,.14);color:var(--red)}
.tag.sk{background:rgba(108,171,221,.16);color:var(--accent)}
.tag.mu{background:var(--chip);color:var(--soft)}
/* shirt */
.sh{position:relative;display:inline-block;width:var(--w,64px);height:var(--w,64px);flex:0 0 auto}
.sh svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))}
.sh .sf{fill:var(--shirt);stroke:rgba(255,255,255,.4);stroke-width:1.5}
.sh .cl{fill:none;stroke:rgba(12,23,51,.35);stroke-width:3}
.sh b{position:absolute;left:0;right:0;top:36%;text-align:center;font-family:'Anybody';font-weight:900;font-variation-settings:'wdth' 75;font-size:calc(var(--w,64px)*.36);line-height:1;color:#0c1733}
.sh i{position:absolute;left:12%;right:12%;top:20%;text-align:center;font-style:normal;font-family:'Anybody';font-weight:800;font-size:calc(var(--w,64px)*.12);letter-spacing:.03em;color:#0c1733;font-variation-settings:'wdth' 78;white-space:nowrap;overflow:hidden;line-height:1.2}
.sh.big b{top:40%}
.sh.empty .sf{fill:transparent;stroke:var(--muted);stroke-dasharray:5 4;stroke-width:2}.sh.empty .cl{stroke:none}.sh.empty b,.sh.empty i{color:var(--muted)}.sh.empty svg{filter:none}
.sh.dim{opacity:.5}
.v2f[data-theme=light] .sh .sf{stroke:rgba(12,23,51,.25)}
/* ═══ desktop shell (quiet) ═══ */
.dk{display:grid;grid-template-columns:224px minmax(0,1fr);grid-template-rows:60px minmax(0,1fr);height:100%}
.hd{grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:0 20px;border-bottom:1px solid var(--pline)}
.hd .br{display:flex;align-items:center;gap:10px;font-family:'Anybody';font-weight:800;font-size:18px;font-variation-settings:'wdth' 118;color:var(--ink);text-decoration:none}
.hd .br img{width:34px;height:34px}
.hd .sep{color:var(--muted)}
.hd .sec{font-weight:600;color:var(--soft)}
.hd .q{margin-left:auto;display:flex;align-items:center;gap:10px;width:320px;height:40px;padding:0 14px;border-radius:12px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);color:var(--muted);font-size:14px}
.hd .q kbd{margin-left:auto;font-family:'Geist Mono';font-size:12px}
.hd .ib{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--pline)}
.rail{display:flex;flex-direction:column;gap:2px;padding:14px 12px;border-right:1px solid var(--pline);min-height:0}
.rail .g{margin:16px 12px 6px;font-size:13px;font-weight:600;color:var(--muted)}
.rail .it{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px;border-radius:12px;font-weight:600;font-size:15px;color:var(--soft);text-align:left;text-decoration:none;width:100%}
.rail .it:hover{background:var(--panel)}
.rail .it[aria-current=page]{background:var(--chip);color:var(--ink);box-shadow:inset 3px 0 0 var(--sky)}
.rail .it .n{margin-left:auto;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:rgba(255,181,71,.16);color:var(--amber);font-family:'Geist Mono';font-size:12px;font-weight:600;display:grid;place-items:center}
.rail .it .x{margin-left:auto;color:var(--muted)}
.rail .me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px;border-top:1px solid var(--pline)}
.av{width:36px;height:36px;border-radius:50%;background:var(--chip);display:grid;place-items:center;font-weight:700;font-size:13px;flex:0 0 auto}
.rail .me small{display:block;color:var(--muted);font-size:13px}
.ws{position:relative;overflow:hidden;padding:22px 28px 24px;display:flex;flex-direction:column;gap:18px;min-height:0}
.ws.anim{animation:vwIn .35s cubic-bezier(.16,1,.3,1)}
@keyframes vwIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.vh{display:flex;align-items:flex-end;gap:16px;flex:0 0 auto}
.vh h1{font-size:36px}
.vh .ld{color:var(--muted);font-size:15px;margin-top:6px}
.vh .r{margin-left:auto;display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.seg2{display:inline-flex;gap:2px;padding:3px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--pline);flex:0 0 auto}
.seg2 button{height:36px;padding:0 14px;border-radius:999px;font-size:14px;font-weight:600;color:var(--soft);white-space:nowrap}
.seg2 button[aria-pressed=true]{background:var(--chip);color:var(--ink);box-shadow:inset 0 0 0 1px var(--pline)}
.seg2.proto{border-style:dashed}
.srch{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;background:var(--input);box-shadow:inset 0 0 0 1px var(--pline);color:var(--muted)}
.srch input{flex:1;min-width:0;border:0;background:none;outline:none;font-size:15px}
.srch input::placeholder{color:var(--placeholder)}
.calm{border-radius:20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);padding:18px 20px;display:flex;flex-direction:column;gap:14px;min-height:0}
.calm>h3,.ch3{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.ch3 em,.calm>h3 em{font-style:normal;color:var(--muted);font-weight:500}
.scr{overflow:auto;overscroll-behavior:contain;min-height:0}
.cta-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.cta-row.end{justify-content:flex-end}
.cta-row .why{color:var(--muted);font-size:14px}
/* ═══ Hoy ═══ */
.hoy{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;flex:1;min-height:0}
.side{display:flex;flex-direction:column;gap:12px;min-height:0}
.side h2{font-family:'Anybody';font-weight:800;font-size:20px;font-variation-settings:'wdth' 110;display:flex;align-items:center;gap:10px}
.side h2 .n{font-family:'Geist Mono';font-size:13px;color:var(--amber);font-weight:600}
.pl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.pi{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;padding:14px 14px 14px 16px;border-radius:16px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline)}
.pi b{font-size:15px}
.pi .d{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14px;grid-column:1}
.pi .btn{grid-row:1/3;grid-column:2}
.dn{display:flex;align-items:center;gap:10px;height:46px;padding:0 16px;border-radius:14px;color:var(--soft);font-weight:600;box-shadow:inset 0 0 0 1px var(--pline);width:100%;text-align:left}
.dn .ck{width:24px;height:24px;border-radius:50%;background:rgba(108,171,221,.18);color:var(--accent);display:grid;place-items:center}
.dn .ch{margin-left:auto;color:var(--muted);display:grid;transition:transform .25s}
.dn[aria-expanded=true] .ch{transform:rotate(180deg)}
.dl{list-style:none;margin:0;padding:0 6px;display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:14px}
.dl li{display:flex;gap:8px;align-items:center}.dl li svg{color:var(--accent);flex:0 0 auto}
.nx{margin-top:auto;padding:14px 16px;border-radius:16px;background:var(--panel);font-size:14px;color:var(--soft);display:flex;flex-direction:column;gap:4px}
.nx b{color:var(--muted);font-size:13px;font-weight:600}
/* peg wall (C) */
.dug{position:relative;border-radius:22px;padding:18px 24px 20px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line);display:flex;flex-direction:column;gap:12px;min-height:0;overflow:hidden}
.dug::before,.wall::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,var(--wall-line) 0 2px,transparent 2px 120px)}
.plaque{position:relative;display:flex;align-items:center;gap:16px;padding:12px 16px;border-radius:12px;background:#eef4ff;color:#0c1733;box-shadow:0 10px 24px rgba(0,0,0,.25)}
.plaque .ttl{font-size:26px;white-space:nowrap}
.plaque .r b{white-space:nowrap}
.plaque small{color:#2c3a5c;font-size:14px;font-weight:500}
.plaque .r{margin-left:auto;text-align:right;font-family:'Geist Mono';font-size:13px;color:#2c3a5c}
.plaque .r b{display:block;font-family:'Anybody';font-size:24px;color:#0c1733;font-variation-settings:'wdth' 90}
.rail2{position:relative;padding-top:20px}
.rail2::before{content:"";position:absolute;left:-8px;right:-8px;top:8px;height:8px;border-radius:4px;background:var(--railbar);box-shadow:0 6px 12px rgba(0,0,0,.3)}
.rail2.lb{padding-top:0}.rail2.lb::before{top:30px}
.rail2 .lbr{position:relative;display:flex;align-items:center;gap:10px;margin-bottom:24px;line-height:20px;font-size:14px;font-weight:600;color:var(--soft)}
.pegs{position:relative;display:flex;gap:12px;justify-content:space-between;align-items:flex-start}
.peg{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:10px;width:96px;text-align:center;border-radius:12px}
.peg::before{content:"";position:absolute;top:-14px;left:50%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:var(--pegdot);box-shadow:0 2px 0 rgba(0,0,0,.3)}
.peg .nm{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.peg .rv{font-size:13px;color:var(--muted)}
.peg .rv.duda{color:var(--amber)}
.peg.sel{box-shadow:0 0 0 2px var(--sky)}
.peg.open .sh{animation:hang .6s cubic-bezier(.3,1.5,.5,1)}
button.peg:hover .sh{transform:translateY(-3px)}
.peg .sh{transition:transform .2s}
@keyframes hang{from{transform:translateY(-14px) rotate(-6deg)}to{transform:none}}
.back .peg{width:84px}
.rs{display:flex;gap:8px;flex-wrap:wrap}
.rs span{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;background:var(--chip);font-size:14px;font-weight:600}
.rs span em{font-style:normal;color:var(--muted);font-weight:500}
.stk{position:absolute;top:30px;right:2px;display:flex;flex-direction:column;gap:3px}
.stk i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#0c1733;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.stk i.y{border-radius:3px;width:14px;height:20px;background:#ffd23f}
/* LED scoreboard (B) — the ONLY LED object */
.sb{position:relative;border-radius:22px;padding:14px;background:linear-gradient(180deg,#1a2442,#0a1126);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 40px 70px -30px rgba(0,0,0,.9);flex:0 0 auto}
.sb .pn{position:relative;border-radius:12px;background:#02050e;padding:30px 26px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;overflow:hidden;min-height:224px}
.sb .pn::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,transparent 1.5px,rgba(2,5,14,.6) 2px);background-size:5px 5px}
.sb .tm,.sb .sub,.sb .mid{position:relative;z-index:2}
.sb .tm{display:flex;flex-direction:column;align-items:center;gap:10px;font-family:'Anybody';font-weight:900;font-size:24px;letter-spacing:.06em;color:var(--led);text-shadow:0 0 14px rgba(159,208,242,.8);white-space:nowrap}
.sb .tm img{width:60px;height:60px;filter:saturate(.8)}
.sb .tm .rc{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:#0d1a3c;font-size:22px}
.led{font-family:'Anybody';font-weight:900;font-variation-settings:'wdth' 78;color:var(--led);text-shadow:0 0 18px rgba(159,208,242,.9),0 0 2px #fff;line-height:1}
.led.gd{color:#ffd98c;text-shadow:0 0 22px rgba(255,198,89,.95)}
.sb .mid{display:flex;flex-direction:column;align-items:center;gap:10px}
.sb .big{font-size:132px;letter-spacing:.02em}
.sb .sub{font-family:'Geist Mono';font-size:15px;letter-spacing:.14em;color:var(--led);text-shadow:0 0 10px rgba(159,208,242,.8)}
.sb .sub.gd{color:#ffd98c;text-shadow:0 0 10px rgba(255,198,89,.8)}
.sb .tick{position:relative;margin-top:10px;border-radius:8px;background:#02050e;height:36px;overflow:hidden;display:flex;align-items:center}
.sb .tick span{white-space:nowrap;padding-left:100%;font-family:'Geist Mono';font-size:14px;letter-spacing:.14em;color:#ffd98c;text-shadow:0 0 10px rgba(255,198,89,.7);animation:mq 24s linear infinite}
@keyframes mq{to{transform:translateX(-100%)}}
.fl{animation:flp .6s cubic-bezier(.3,1.4,.5,1)}
@keyframes flp{from{transform:rotateX(-80deg);filter:brightness(2)}to{transform:none}}
.gfx{animation:ledfl 2.4s steps(1) both}
@keyframes ledfl{0%{opacity:1}10%{opacity:.2}20%{opacity:1}30%{opacity:.3}40%,100%{opacity:1}}
.hB{display:flex;flex-direction:column;gap:16px;min-height:0}
.live2{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;flex:1;min-height:0}
.evl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.evl li{display:grid;grid-template-columns:44px 26px 1fr auto;gap:8px;align-items:center;font-size:15px;min-height:36px}
.evl li .m{font-family:'Geist Mono';font-size:14px;color:var(--muted)}
.evl li .ic{color:var(--accent);display:grid;place-items:center}
.evl li.rv .ic{color:var(--muted)}
.evl li.y .ic{color:#e8b800}
.evl li.rj .ic{color:var(--red)}
.evl li small{color:var(--muted);font-size:14px}
.evl li.fresh{animation:rise .5s cubic-bezier(.16,1,.3,1)}
.pads{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start}
.v2f .pad{height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:10px;font-family:'Anybody';font-weight:900;font-size:19px;letter-spacing:.03em;background:var(--chip);box-shadow:inset 0 0 0 1px var(--pline)}
.v2f .pad.gol{background:var(--cta);color:var(--cta-ink);box-shadow:var(--cta-shadow);font-size:24px}
.v2f .pad.mas,.v2f .pad.fin{grid-column:1/-1}
.v2f .pad.fin{height:50px;font-family:'Geist';font-weight:600;font-size:15px;letter-spacing:0;background:transparent}
/* ═══ Partidos ═══ */
.pt{display:grid;grid-template-columns:350px minmax(0,1fr);gap:20px;flex:1;min-height:0}
.ml{display:flex;flex-direction:column;gap:10px;min-height:0;border-radius:20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);padding:12px}
.ml .scr{flex:1;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.mgh{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:8px 6px 6px;font-size:14px;font-weight:700;background:var(--stick);color:var(--soft)}
.v2f:not([data-theme=light]) .ml .mgh{background:#071029}
.mgh em{font-style:normal;color:var(--muted);font-weight:500}
.mr{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:62px;padding:8px 10px;border-radius:14px;text-align:left;width:100%}
.mr:hover{background:var(--panel2)}
.mr[aria-current=true]{background:var(--chip);box-shadow:inset 3px 0 0 var(--sky),inset 0 0 0 1px var(--pline)}
.mr .j{display:flex;flex-direction:column;align-items:center;line-height:1.1}
.mr .j b{font-family:'Anybody';font-weight:900;font-size:19px;font-variation-settings:'wdth' 90}
.mr .j small{font-size:12px;color:var(--muted);white-space:nowrap}
.mr .w{min-width:0}
.mr .w b{display:block;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mr .w small{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}
.mr .w small.am{color:var(--amber);font-weight:600}
.mr .s{display:flex;align-items:center;gap:8px;font-family:'Anybody';font-weight:900;font-size:20px;font-variation-settings:'wdth' 85;white-space:nowrap}
.mr .s.t{font-family:'Geist Mono';font-weight:600;font-size:14px;color:var(--soft)}
.det{display:flex;flex-direction:column;min-height:0;border-radius:20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);overflow:hidden;position:relative}
.dh{display:flex;align-items:center;gap:16px;padding:12px 16px 12px 20px;border-bottom:1px solid var(--pline);flex:0 0 auto}
.dh .tt{min-width:0;display:flex;flex-direction:column;gap:2px}
.dh .tt small{font-size:13px;color:var(--muted);white-space:nowrap}
.dh .tt b{display:flex;align-items:center;gap:10px;font-family:'Anybody';font-weight:900;font-size:24px;font-variation-settings:'wdth' 100;white-space:nowrap}
.dh .tt b .sc{color:var(--accent)}
.tabs4{margin-left:auto;display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--panel)}
.tabs4 button{height:42px;padding:0 14px;border-radius:11px;font-size:14px;font-weight:600;color:var(--soft);display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.tabs4 button[aria-selected=true]{background:var(--chip);color:var(--ink);box-shadow:inset 0 -2px 0 var(--sky),inset 0 0 0 1px var(--pline)}
.tabs4 .tk{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700}
.tabs4 .tk.ok{background:rgba(108,171,221,.2);color:var(--accent)}
.tabs4 .tk.wn{background:rgba(255,181,71,.2);color:var(--amber)}
.db{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:16px 20px 20px}
.df{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 20px;border-top:1px solid var(--pline)}
.df .st{display:flex;flex-direction:column;gap:2px;margin-right:auto;min-width:0}
.df .st small{color:var(--muted);font-size:13px}
.df .shake{animation:shk .4s}
@keyframes shk{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.acta{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:20px;align-items:start}
.acol{display:flex;flex-direction:column;gap:20px;min-width:0}
.ah{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.ah h3{font-size:16px;font-weight:700}
.ah .n{font-family:'Geist Mono';font-size:13px;color:var(--muted)}
.ah .add{margin-left:auto}
.gl{display:flex;flex-direction:column;gap:8px}
.gr{display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:68px;padding:8px 8px 8px 10px;border-radius:14px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);width:100%;text-align:left}
.gr .m{display:grid;place-items:center;height:48px;border-radius:10px;background:var(--input);box-shadow:inset 0 0 0 1px var(--pline);font-family:'Geist Mono';font-size:16px;font-weight:600;color:var(--accent)}
.gr b{display:block;font-family:'Anybody';font-weight:800;font-size:20px;font-variation-settings:'wdth' 100;line-height:1.15}
.gr small{color:var(--muted);font-size:14px}
.gr .e{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:var(--soft);box-shadow:inset 0 0 0 1px var(--pline)}
.gr.miss{box-shadow:inset 0 0 0 1.5px var(--amber)}
.gr.miss b{color:var(--amber)}
.gr.act{box-shadow:inset 0 0 0 2px var(--sky);background:var(--chip)}
.gr.rvl b{color:var(--soft)}
.picker{position:relative;margin-top:-2px;border-radius:16px;background:var(--pop);box-shadow:inset 0 0 0 1.5px var(--sky),0 24px 50px -20px rgba(0,0,0,.7);padding:14px;display:flex;flex-direction:column;gap:10px;animation:pkIn .3s cubic-bezier(.16,1,.3,1)}
.picker::before{content:"";position:absolute;top:-8px;left:40px;width:14px;height:14px;background:var(--pop);transform:rotate(45deg);box-shadow:-1.5px -1.5px 0 var(--sky)}
@keyframes pkIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.pkh{display:flex;align-items:center;gap:10px}
.pkh b{font-family:'Anybody';font-weight:900;font-size:20px}
.pkh small{display:block;color:var(--accent);font-size:13px;font-weight:600}
.pkh .x{margin-left:auto}
.pk-lb{font-size:13px;font-weight:600;color:var(--muted)}
.pg{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.pp{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:66px;border-radius:12px;background:var(--chip);box-shadow:inset 0 0 0 1px var(--pline);padding:4px}
.pp:hover{box-shadow:inset 0 0 0 1.5px var(--sky)}
.pp b{font-family:'Anybody';font-weight:900;font-size:24px;font-variation-settings:'wdth' 80;line-height:1}
.pp small{font-size:12px;font-weight:600;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pp.bench{opacity:.78}
.pp.on{background:var(--pill-on);color:var(--pill-on-ink)}
.pkx{display:flex;gap:8px;flex-wrap:wrap}
.pkx button{min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;font-size:14px;box-shadow:inset 0 0 0 1px var(--pline)}
.evg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.eg{border-radius:14px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.eg .ah{margin-bottom:2px}.eg .ah h3{font-size:15px}
.eg .emp{font-size:14px;color:var(--muted)}
.cuenta{display:flex;flex-direction:column;gap:14px;position:sticky;top:0}
.dots{display:flex;flex-direction:column;gap:12px}
.dots .r{display:flex;flex-direction:column;gap:6px}
.dots .r span{font-size:14px;color:var(--soft);display:flex;justify-content:space-between}
.dots .r span b{font-family:'Geist Mono';font-size:13px}
.dots .r i{display:flex;gap:6px}
.dots .r i u{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--muted);text-decoration:none;transition:background .3s}
.dots .r i u.on{background:var(--sky);box-shadow:none;animation:pop .45s cubic-bezier(.3,1.6,.5,1)}
.dots .r i u.miss{box-shadow:inset 0 0 0 2px var(--amber)}
.ck2{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.ck2 li{display:grid;grid-template-columns:24px 1fr;gap:8px;font-size:14px;color:var(--soft)}
.ck2 li .i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(108,171,221,.18);color:var(--accent)}
.ck2 li.no .i{background:rgba(255,181,71,.18);color:var(--amber)}
.ck2 li small{display:block;color:var(--muted);font-size:13px}
/* Encuentro form groups */
.fgs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
.fg{border-radius:16px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px}
.fg h3{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px}
.fg h3 span{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--chip);color:var(--accent)}
.fld{display:flex;flex-direction:column;gap:6px;min-width:0}
.fld label,.fld .lb{font-size:13px;font-weight:600;color:var(--muted)}
.inp{height:44px;border-radius:12px;padding:0 12px;border:0;outline:none;background:var(--input);box-shadow:inset 0 0 0 1px var(--pline);font-size:15px;width:100%;min-width:0}
.inp:focus{box-shadow:inset 0 0 0 2px var(--sky)}
textarea.inp{height:auto;min-height:84px;padding:10px 12px;resize:none;line-height:1.45}
.inp.bad{box-shadow:inset 0 0 0 1.5px var(--red)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sgf{display:flex;gap:2px;padding:3px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--pline);flex-wrap:wrap}
.sgf button{flex:1;min-height:38px;padding:0 10px;border-radius:9px;font-size:14px;font-weight:600;color:var(--soft);white-space:nowrap}
.sgf button[aria-pressed=true]{background:var(--pill-on);color:var(--pill-on-ink)}
.hint{font-size:13px;color:var(--muted)}
.danger{display:flex;align-items:center;gap:14px;margin-top:16px;padding:14px 16px;border-radius:16px;box-shadow:inset 0 0 0 1px var(--pline)}
.danger p{flex:1;font-size:14px;color:var(--muted)}
.danger p b{display:block;color:var(--ink);font-size:15px}
/* Convocatoria (read) + Publicar tabs */
.cvr{display:flex;flex-direction:column;gap:16px}
.s7r{display:flex;gap:10px;justify-content:space-between;padding:22px 18px 14px;border-radius:18px;background:var(--wall);position:relative}
.s7r .peg{width:auto;flex:1}
.pubg{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:start}
.cron{border-radius:16px;background:#eef4ff;color:#0c1733;padding:16px 18px;display:flex;flex-direction:column;gap:8px;font-size:15px;line-height:1.5}
.cron .k{font-family:'Geist Mono';font-size:12px;letter-spacing:.08em;color:#2c3a5c}
.cron b{font-family:'Anybody';font-weight:900;font-size:22px;line-height:1.1}
.mins{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.mins span{display:flex;align-items:center;gap:8px;font-size:14px;padding:6px 10px;border-radius:10px;background:var(--panel)}
.mins span b{margin-left:auto;font-family:'Geist Mono';font-size:13px;color:var(--accent)}
.mvpc{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:16px;background:var(--chip-gold)}
.mvpc .st{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(255,198,89,.2);color:var(--gold-ink);flex:0 0 auto}
.mvpc b{display:block}.mvpc small{color:var(--soft);font-size:14px}
/* ═══ Publish peak: FINAL flip → vitrina ═══ */
.pubv{position:absolute;inset:0;z-index:15;display:flex;flex-direction:column;align-items:center;gap:16px;padding:26px 28px;background:radial-gradient(70% 55% at 50% 0%,#1d3f84,#050b1f 70%);overflow:hidden;color:#eef4ff;--ink:#eef4ff;--soft:#c9d8ef;--muted:#9fb3d3;--panel:rgba(255,255,255,.05);--pline:rgba(255,255,255,.1);--chip:rgba(255,255,255,.08);--accent:#9fd0f2}
.pubv .wh{display:flex;align-items:center;gap:8px;color:#c9d8ef;font-weight:600;font-size:15px;animation:fade .5s both}
.pubv .sb{width:min(640px,100%);animation:sbOut .8s cubic-bezier(.6,0,.4,1) 2.2s both}
.pubv .sb .pn{min-height:0;padding:18px 22px}
.pubv .sb .big{font-size:96px}
.pubv .sb .tm{font-size:20px}.pubv .sb .tm img,.pubv .sb .tm .rc{width:44px;height:44px}
@keyframes sbOut{from{opacity:1}to{opacity:.35;transform:scale(.92)}}
.pubv .lock{animation:lockin .7s cubic-bezier(.3,1.5,.5,1) .5s both}
@keyframes lockin{from{transform:scale(1.4);opacity:0;filter:brightness(2.5)}to{transform:none;opacity:1}}
.pubv .flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(50% 35% at 50% 18%,rgba(255,217,140,.45),transparent 70%);animation:flsh 1.6s ease-out .45s both}
@keyframes flsh{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
.vit{position:relative;width:min(640px,100%);border-radius:18px;padding:18px 18px 14px;background:linear-gradient(180deg,rgba(159,208,242,.16),rgba(159,208,242,.04));box-shadow:inset 0 0 0 1.5px rgba(159,208,242,.38),0 0 50px rgba(108,171,221,.25);animation:vup 1s cubic-bezier(.16,1,.3,1) 2.4s both}
.vit::before{content:"";position:absolute;inset:0;border-radius:18px;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.12) 45%,transparent 55%);pointer-events:none}
@keyframes vup{from{transform:translateY(80px);opacity:0}to{transform:none;opacity:1}}
.vit .s7{display:flex;justify-content:space-between;gap:6px}
.vit .s7 .peg{width:auto;flex:1;padding-top:0}.vit .s7 .peg::before{display:none}
.vit .s7 .peg:nth-child(odd) .sh{animation:shUp .9s cubic-bezier(.16,1,.3,1) 2.6s both}
.vit .s7 .peg:nth-child(even) .sh{animation:shUp .9s cubic-bezier(.16,1,.3,1) 2.75s both}
@keyframes shUp{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
.vit .pq{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;border-radius:10px;background:#eef4ff;color:#0c1733;font-family:'Anybody';font-weight:900;font-size:24px;box-shadow:0 10px 20px rgba(0,0,0,.3)}
.vit .pq small{font-family:'Geist';font-weight:600;font-size:14px;color:#2c3a5c}
.shelf{display:flex;align-items:center;gap:6px;justify-content:center;animation:fade .6s 3.1s both}
.shelf .lb{font-size:13px;font-weight:600;color:#c9d8ef;margin-right:6px}
.shelf .nw{animation:pop .7s cubic-bezier(.3,1.6,.5,1) 3.4s both;box-shadow:0 0 0 2px #eef4ff}
.l3p{display:flex;width:min(640px,100%);animation:l3in .7s cubic-bezier(.16,1,.3,1) 3.6s both}
.l3p .k{display:grid;place-items:center;padding:0 14px;background:var(--sky);color:#0c1733}
.l3p .t{flex:1;padding:10px 16px;background:#050b1f;color:#fff;font-weight:700;font-size:16px;box-shadow:inset 0 -3px 0 var(--sky)}
.l3p .t small{display:block;font-weight:500;font-size:13px;color:#c9d8ef}
.ho{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:min(640px,100%);animation:rise .7s cubic-bezier(.16,1,.3,1) 4s both}
.hc{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;border-radius:16px;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.hc .btn{grid-column:1/-1}
.hc b{display:block;font-size:15px}.hc small{color:#9fb3d3;font-size:14px}
.cartel{width:58px;height:76px;border-radius:8px;background:radial-gradient(80% 60% at 50% 20%,#2a5b98,#0c1733);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,198,89,.6)}
.cartel b{font-family:'Anybody';font-weight:900;font-size:20px;line-height:1}
.cartel span{font-size:12px;font-weight:700}
.mvp{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(255,198,89,.14);color:#ffd98c}
.ho .lk{grid-column:1/-1;display:flex;gap:10px}.ho .lk .btn{flex:1}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes pop{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
@keyframes l3in{from{transform:translateX(-104%)}to{transform:none}}
/* ═══ Convocar ═══ */
.cvv{display:grid;grid-template-columns:400px minmax(0,1fr);gap:20px;flex:1;min-height:0}
.pool{display:flex;flex-direction:column;gap:14px;padding-right:6px}
.pool h3{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;position:sticky;top:0;background:var(--stick);padding:6px 0;z-index:1}
.v2f:not([data-theme=light]) .pool h3{background:#050c22}
.pool h3 em{font-style:normal;color:var(--muted);font-weight:500}
.pool .gw{display:flex;flex-direction:column;gap:6px}
.pr{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:56px;padding:6px 8px 6px 12px;border-radius:12px;background:var(--panel)}
.pr .nb{font-family:'Anybody';font-weight:900;font-size:22px;font-variation-settings:'wdth' 80;color:var(--accent)}
.pr b{font-size:15px}.pr small{display:block;color:var(--muted);font-size:13px}
.pr .ac{display:flex;gap:6px}
.pr.no{opacity:.6}
.sv{display:flex;flex-direction:column;gap:14px;border-radius:20px;padding:18px 22px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line);min-height:0;position:relative;overflow:hidden}
.sv .ttl{font-size:24px}
.sv .rail2 .pegs{gap:6px}
.sv .bq{display:flex;gap:16px;flex-wrap:wrap}
.src{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--glass);font-size:14px;color:var(--soft);position:relative}
.src b{color:var(--ink)}
.src svg{flex:0 0 auto;color:var(--accent)}
/* «La pizarra coincide» / «La pizarra tiene otro siete» (Convocar): the words say it, the icon backs them. */
.pzc{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);font-size:14px;color:var(--soft)}
.pzc>span{flex:1 1 220px;display:flex;flex-direction:column;gap:2px}
.pzc b{color:var(--ink)}
.pzc>svg{flex:0 0 auto;color:var(--accent)}
.pzc.otro>svg{color:var(--amber)}
/* ═══ Fichas ═══ */
.fcg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.fc{position:relative;display:grid;grid-template-columns:132px minmax(0,1fr);gap:18px;padding:18px;border-radius:20px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line);overflow:hidden}
.fc .hang{position:relative;display:flex;flex-direction:column;align-items:center;padding-top:16px}
.fc .hang::before{content:"";position:absolute;top:0;left:-18px;right:-6px;height:7px;border-radius:4px;background:var(--railbar)}
.fc .hang::after{content:"";position:absolute;top:-3px;left:50%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:var(--pegdot)}
.fc .tx{display:flex;flex-direction:column;gap:8px;min-width:0}
.fc .who{font-size:14px;color:var(--accent);font-weight:600}
.fc h3{font-family:'Anybody';font-weight:900;font-size:24px;line-height:1.1;font-variation-settings:'wdth' 100}
.fc .meta{display:flex;flex-direction:column;gap:2px;font-size:14px;color:var(--muted)}
.fc .meta span{overflow-wrap:anywhere}
.fc .ac{display:flex;gap:10px;margin-top:auto;padding-top:6px}
.fc .ac .btn{flex:1}
.fc.gone{animation:fcOut .4s both}
@keyframes fcOut{to{opacity:0;transform:scale(.96)}}
.rsl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rsl li{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:var(--panel);font-size:14px;color:var(--soft)}
.rsl li b{color:var(--ink)}
.rsl li .btn{margin-left:auto}
.void{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:30px;border-radius:20px;background:var(--wall);min-height:300px}
.void h3{font-family:'Anybody';font-weight:900;font-size:26px}
.void p{color:var(--muted);max-width:420px}
.expl{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.expl div{padding:14px 16px;border-radius:16px;background:var(--panel);font-size:14px;color:var(--soft)}
.expl b{display:block;color:var(--ink);margin-bottom:4px}
/* ═══ Plantilla ═══ */
.plg{flex:1;min-height:0;display:flex;gap:20px}
.wall{position:relative;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;border-radius:20px;padding:6px 24px 20px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line)}
.wall .rail2{margin-top:16px}
.wall .pegs{justify-content:flex-start;gap:14px}
.wall .peg{width:116px}
.wall .peg.alta .nm{color:var(--accent)}
.wall .nores{position:relative;padding:60px 0;text-align:center;color:var(--muted)}
.drw{flex:0 0 420px;border-radius:20px;overflow:hidden;background:var(--sheet);box-shadow:inset 0 0 0 1px var(--pline);display:flex;flex-direction:column;animation:drw .45s cubic-bezier(.16,1,.3,1);min-height:0}
@keyframes drw{from{transform:translateX(60px);opacity:0}to{transform:none;opacity:1}}
.cromo{position:relative;margin:16px 16px 0;padding:16px 18px;border-radius:18px;background:radial-gradient(80% 70% at 70% 20%,#2a5b98,#0c1c46 70%);box-shadow:inset 0 0 0 2px rgba(255,198,89,.55);display:grid;grid-template-columns:1fr auto;gap:10px 16px;align-items:center;color:#eef4ff;flex:0 0 auto}
.cromo .rt{font-family:'Anybody';font-weight:900;font-size:50px;line-height:.9;color:#ffd98c}
.cromo .ps{font-family:'Anybody';font-weight:800;font-size:17px;color:#eef4ff}
.cromo .nm{grid-column:1/-1;font-family:'Anybody';font-weight:900;font-size:28px;color:#eef4ff;line-height:1}
.cromo .st{grid-column:1/-1;display:flex;gap:16px;font-family:'Geist Mono';font-size:13px;color:#c9d8ef}
.cromo .st b{font-family:'Anybody';font-size:19px;color:#fff;margin-right:4px}
.cromo.new{background:var(--wall);box-shadow:inset 0 0 0 2px var(--pline);color:var(--ink)}
.cromo.new .nm{color:var(--ink)}
.drh{display:flex;align-items:center;gap:10px;padding:12px 16px 0}
.drh b{font-size:15px}.drh small{color:var(--amber);font-size:13px;font-weight:600}
.drh .x{margin-left:auto}
.ib2{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--pline);flex:0 0 auto}
.fx2{padding:14px 16px;display:flex;flex-direction:column;gap:12px;overflow:auto;flex:1;min-height:0}
.fx2 .ok{display:flex;align-items:center;gap:6px;color:var(--accent);font-size:13px}
.fx2 .er{display:flex;align-items:center;gap:6px;color:var(--red);font-size:13px}
.tgl{display:flex;flex-wrap:wrap;gap:8px}
.tgl button{min-height:38px;padding:0 12px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:inset 0 0 0 1px var(--pline);color:var(--soft)}
.tgl button[aria-pressed=true]{background:var(--chip);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--sky)}
.drw .ft{display:flex;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid var(--pline)}
.drw .ft .sp{margin-right:auto}
/* ═══ Temporadas ═══ */
.tg{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px;flex:1;min-height:0}
.cab{position:relative;border-radius:22px;padding:22px 24px;background:linear-gradient(180deg,#14284f,#08132f);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 -14px 0 -6px rgba(255,198,89,.25);display:flex;flex-direction:column;gap:18px;color:#eef4ff;--ink:#eef4ff;--soft:#c9d8ef;--muted:#9fb3d3;--pline:rgba(255,255,255,.12);--chip:rgba(255,255,255,.08);--panel:rgba(255,255,255,.05);--accent:#9fd0f2;--input:rgba(255,255,255,.06);overflow:hidden}
.cab::after{content:"";position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,#b88a2c,#ffd98c,#b88a2c)}
.cab .top{display:flex;align-items:flex-start;gap:14px}
.cab .top h2{font-size:34px}
.cab .top .tag{margin-top:6px}
.cab .top .r{margin-left:auto;display:flex;gap:8px}
.ren{display:flex;gap:8px;align-items:center}.ren .inp{width:280px}
.rec{display:grid;grid-template-columns:repeat(3,1fr) 1.2fr;gap:12px}
.rec>div{border-radius:16px;padding:14px;background:rgba(255,255,255,.05);display:flex;flex-direction:column;gap:6px}
.rec .k{font-size:13px;font-weight:600;color:#9fb3d3;display:flex;align-items:center;gap:6px}
.rec .v{font-family:'Anybody';font-weight:900;font-size:44px;line-height:1;font-variation-settings:'wdth' 85}
.rec .v small{font-size:20px;color:#9fb3d3}
.pich{display:flex;gap:12px;align-items:center}
.pich b{display:block;font-family:'Anybody';font-weight:900;font-size:20px}
.pich small{color:#c9d8ef;font-size:14px}
.jshelf{display:grid;grid-template-columns:repeat(22,1fr);gap:4px}
.jshelf .ved{width:100%;height:30px}
.cab .fot{display:flex;gap:16px;align-items:center;color:#c9d8ef;font-size:14px;margin-top:auto;padding-bottom:6px}
.tcol{display:flex;flex-direction:column;gap:16px;min-height:0}
.arch{border-radius:20px;padding:18px 20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);display:flex;flex-direction:column;gap:12px;position:relative}
.arch .top{display:flex;align-items:center;gap:10px}
.arch h3{font-family:'Anybody';font-weight:900;font-size:22px}
.arch .rr{display:flex;gap:16px;font-size:14px;color:var(--muted)}
.arch .rr b{color:var(--ink);font-family:'Anybody';font-size:18px;margin-right:4px}
.arch.isA{background:repeating-linear-gradient(135deg,transparent 0 10px,rgba(159,179,211,.04) 10px 20px),var(--panel)}
.newS{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:18px 20px;border-radius:20px;box-shadow:inset 0 0 0 1.5px var(--pline);border:0;background:none;text-align:left}
.newS b{font-family:'Anybody';font-weight:900;font-size:20px}
.newS small{color:var(--muted);font-size:14px}
/* ═══ Capitanes ═══ */
.cpg{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;flex:1;min-height:0}
.lk2{display:flex;flex-direction:column;gap:10px;padding-right:4px}
.lk2 .gh{font-size:15px;font-weight:700;display:flex;gap:8px;align-items:center;margin-top:6px}
.lk2 .gh em{font-style:normal;color:var(--muted);font-weight:500}
.mem{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 14px;border-radius:16px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline)}
.mem .pic{position:relative;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#1d3f84,#0c1733);display:grid;place-items:center;font-weight:800;font-size:16px;color:#eef4ff}
.arm{position:absolute;left:-6px;bottom:-4px;height:22px;padding:0 7px;border-radius:5px;background:var(--sky);color:#0c1733;font-family:'Anybody';font-weight:900;font-size:13px;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.4);transform:rotate(-8deg)}
.arm.gd{background:#FFC659}
.mem .w b{font-size:16px}
.mem .w small{display:block;color:var(--muted);font-size:14px;overflow-wrap:anywhere}
.mem .w .tag{margin-top:4px}
.mem .ac{display:flex;align-items:center;gap:8px}
.mem .prot{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;font-weight:600}
.rules{border-radius:20px;padding:18px 20px;background:var(--wall);display:flex;flex-direction:column;gap:12px;font-size:14px;color:var(--soft)}
.rules h3{font-family:'Anybody';font-weight:900;font-size:20px;color:var(--ink)}
.rules li{margin-bottom:6px}
.rules ul{margin:0;padding-left:18px}
/* ═══ Contenido: programa del club ═══ */
.prg{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px;flex:1;min-height:0}
.prg.wd{grid-template-columns:minmax(0,1fr) 440px}
.cover{position:relative;border-radius:20px;padding:22px;background:radial-gradient(90% 60% at 60% 20%,#2a5b98,#0c1733 75%);color:#eef4ff;display:flex;flex-direction:column;gap:10px;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(255,198,89,.4)}
.cover img{width:72px;height:72px}
.cover .k{font-family:'Geist Mono';font-size:13px;letter-spacing:.1em;color:#c9d8ef}
.cover h2{font-family:'Anybody';font-weight:900;font-size:40px;line-height:.95}
.cover p{color:#c9d8ef;font-size:14px}
.cover .ed{margin-top:auto;font-family:'Geist Mono';font-size:13px;color:#ffd98c}
.idx{display:flex;flex-direction:column;border-radius:20px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--pline);min-height:0}
.idx .scr{flex:1;padding:6px 10px}
.ir{display:grid;grid-template-columns:50px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;min-height:64px;padding:8px 10px;border-radius:12px;text-align:left;border-bottom:1px dashed var(--pline)}
.ir:hover{background:var(--panel2)}
.ir[aria-current=true]{background:var(--chip);box-shadow:inset 3px 0 0 var(--sky)}
.ir .no{font-family:'Anybody';font-weight:900;font-size:26px;color:var(--accent);font-variation-settings:'wdth' 80}
.ir b{display:block;font-size:16px}
.ir small{display:block;color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ir .pg2{font-family:'Geist Mono';font-size:13px;color:var(--muted);white-space:nowrap}
.pbar{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 18px;border-top:1px solid var(--pline)}
.pbar p{margin-right:auto;font-size:14px;color:var(--soft)}
.pbar p b{display:block;color:var(--ink);font-size:15px}
.ce{display:flex;flex-direction:column;border-radius:20px;background:var(--sheet);box-shadow:inset 0 0 0 1px var(--pline);min-height:0;animation:drw .45s cubic-bezier(.16,1,.3,1);overflow:hidden}
.ce .hh{display:flex;align-items:center;gap:10px;padding:16px 16px 10px}
.ce .hh h3{font-family:'Anybody';font-weight:900;font-size:22px}
.ce .hh small{display:block;font-size:13px;color:var(--muted)}
.ce .hh .x{margin-left:auto}
.hl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.hl li{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--panel)}
.hl li .d{font-family:'Geist Mono';font-size:13px;color:var(--muted)}
.hl li.dr{box-shadow:inset 0 0 0 1.5px var(--amber)}
/* ═══ layers: palette, modal, sheet, lower third ═══ */
.scrim{position:absolute;inset:0;z-index:40;background:var(--scrim);animation:fade .25s both}
.pal{position:absolute;z-index:41;left:50%;top:90px;width:640px;margin-left:-320px;border-radius:20px;background:var(--sheet);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 0 0 1px var(--pline);display:flex;flex-direction:column;max-height:620px;overflow:hidden;animation:mdIn .3s cubic-bezier(.3,1.3,.5,1)}
@keyframes mdIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.pal .qi{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--pline);color:var(--muted)}
.pal .qi input{flex:1;border:0;background:none;outline:none;font-size:18px;color:var(--ink)}
.pal .qi kbd{font-family:'Geist Mono';font-size:12px;padding:3px 8px;border-radius:6px;box-shadow:inset 0 0 0 1px var(--pline)}
.pal .scr{padding:8px}
.pal .gh{padding:10px 10px 4px;font-size:13px;font-weight:600;color:var(--muted)}
.pal .op{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:0 12px;border-radius:12px;text-align:left;font-size:15px}
.pal .op small{margin-left:auto;color:var(--muted);font-size:13px}
.pal .op[aria-selected=true]{background:var(--chip);box-shadow:inset 3px 0 0 var(--sky)}
.pal .op svg{color:var(--accent)}
.pal .ft{display:flex;gap:16px;padding:10px 16px;border-top:1px solid var(--pline);font-size:13px;color:var(--muted)}
.pal .none{padding:30px;text-align:center;color:var(--muted)}
.md{position:absolute;z-index:41;left:50%;top:50%;width:520px;margin-left:-260px;transform:translateY(-50%);border-radius:22px;background:var(--sheet);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 0 0 1px var(--pline);padding:22px;display:flex;flex-direction:column;gap:14px;animation:mdIn2 .3s cubic-bezier(.3,1.3,.5,1)}
@keyframes mdIn2{from{opacity:0;transform:translateY(-50%) scale(.96)}to{opacity:1;transform:translateY(-50%)}}
.md h2{font-family:'Anybody';font-weight:900;font-size:26px;line-height:1.1}
.md .cs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.md .cs li{display:flex;gap:10px;align-items:flex-start;font-size:15px;color:var(--soft)}
.md .cs li svg{flex:0 0 auto;margin-top:2px;color:var(--accent)}
.md.dz .cs li svg{color:var(--red)}
.md .ac{display:flex;gap:10px;justify-content:flex-end;margin-top:4px}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:41;border-radius:22px 22px 0 0;background:var(--sheet);box-shadow:0 -20px 50px rgba(0,0,0,.5);padding:8px 16px 18px;display:flex;flex-direction:column;gap:12px;animation:shIn .45s cubic-bezier(.16,1,.3,1);max-height:92%;overflow:auto}
@keyframes shIn{from{transform:translateY(100%)}to{transform:none}}
.sheet .gb{width:44px;height:5px;border-radius:3px;background:var(--pline);margin:0 auto;flex:0 0 auto}
.sheet .hh{display:flex;align-items:center;gap:10px}
.sheet .hh b{font-family:'Anybody';font-weight:900;font-size:22px}
.sheet .hh small{display:block;color:var(--accent);font-size:13px;font-weight:600}
.sheet .hh .x{margin-left:auto}
.sheet .pg{grid-template-columns:repeat(4,1fr)}
.lpk{position:absolute;z-index:41;left:50%;top:120px;width:680px;margin-left:-340px;border-radius:22px;background:var(--sheet);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 0 0 1.5px var(--sky);padding:18px;display:flex;flex-direction:column;gap:12px;animation:mdIn .3s cubic-bezier(.3,1.3,.5,1)}
.msl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.msl button,.msl a{display:flex;align-items:center;gap:14px;width:100%;min-height:52px;padding:0 10px;border-radius:12px;font-size:16px;font-weight:600;text-align:left;color:var(--ink);text-decoration:none}
.msl .n{margin-left:auto;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:rgba(255,181,71,.16);color:var(--amber);font-family:'Geist Mono';font-size:12px;display:grid;place-items:center}
.msl .x2{margin-left:auto;color:var(--muted)}
.msl svg{color:var(--accent)}
.mcap{display:flex;align-items:center;gap:12px;padding:12px;border-radius:16px;background:var(--panel)}
.mcap small{display:block;color:var(--muted);font-size:13px}
.lt{position:absolute;z-index:60;left:12px;bottom:16px;max-width:540px;display:flex;align-items:stretch;border-radius:4px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);animation:l3in .5s cubic-bezier(.16,1,.3,1)}
.lt .k{display:grid;place-items:center;padding:0 12px;background:var(--sky);color:#0c1733;font-family:'Anybody';font-weight:900;font-size:14px;letter-spacing:.06em}
.lt .t{display:flex;align-items:center;gap:14px;padding:9px 14px;background:#050b1f;color:#eef4ff;font-weight:600;font-size:15px;box-shadow:inset 0 -3px 0 var(--sky)}
.lt .t button{color:#9fd0f2;font-weight:700;display:inline-flex;gap:6px;align-items:center;min-height:36px;white-space:nowrap}
/* ═══ mobile ═══ */
.mb{position:relative;height:100%;display:flex;flex-direction:column}
.mh{display:flex;align-items:center;gap:10px;height:60px;padding:0 12px 0 16px;flex:0 0 auto}
.mh img{width:32px;height:32px}
.mh .t{font-family:'Anybody';font-weight:900;font-size:24px;font-variation-settings:'wdth' 112}
.mh .ib{margin-left:auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px var(--pline)}
.mh .ib+.ib{margin-left:0}
.msc{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:4px 16px 16px;display:flex;flex-direction:column;gap:14px}
.bar{flex:0 0 auto;height:68px;display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--pline);background:var(--stick)}
.v2f:not([data-theme=light]) .bar{background:rgba(5,11,31,.96)}
.bar button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;font-weight:600;color:var(--muted)}
.bar button[aria-current=page]{color:var(--ink)}
.bar button[aria-current=page]::before{content:"";position:absolute;top:0;left:28%;right:28%;height:3px;border-radius:0 0 3px 3px;background:var(--sky)}
.bar .bd{position:absolute;top:7px;left:56%;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--amber);color:#0c1733;font-size:12px;font-weight:700;display:grid;place-items:center}
.m .lt{left:12px;right:12px;bottom:var(--ltb,80px);max-width:none}
.m .lt .t{flex:1;justify-content:space-between;font-size:14px}
.mdug{position:relative;border-radius:18px;padding:12px 12px 14px;background:var(--wall);display:flex;flex-direction:column;gap:12px;overflow:hidden}
.mplq{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:#eef4ff;color:#0c1733}
.mplq .ttl{font-size:22px}
.mplq small{font-size:13px;color:#2c3a5c;font-weight:500}
.mplq .ck{margin-left:auto;font-family:'Geist Mono';font-weight:600;font-size:14px;text-align:right;line-height:1.2}
.mrail{position:relative;padding-top:16px}
.mrail::before{content:"";position:absolute;left:-12px;right:-12px;top:6px;height:6px;border-radius:3px;background:var(--railbar)}
.mrail .pegs{gap:2px}
.mrail .peg{width:48px;gap:2px;padding-top:6px}
.mrail .peg::before{top:-12px;width:9px;height:9px;margin-left:-4.5px}
.mrail .peg .nm{font-size:12px;max-width:50px}
.mrail .stk{top:2px;right:-4px}
.mrail .stk i{width:18px;height:18px}
.mrail .stk i.y{width:11px;height:16px}
/* live mobile */
.lv{flex:0 0 auto;padding:8px 12px 12px;display:flex;flex-direction:column;gap:10px;background:#050b1f;border-bottom:1px solid rgba(255,255,255,.09);position:relative;color:#eef4ff}
.lv .r1{display:flex;align-items:center;gap:10px;min-height:44px}
.lv .r1 .bk{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#eef4ff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.lv .r1 .ml{margin-left:auto;font-family:'Geist Mono';font-size:13px;color:#9fb3d3}
.tally{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border-radius:6px;font-family:'Geist Mono';font-size:13px;font-weight:600;letter-spacing:.08em;color:#ff8a82;background:rgba(255,90,79,.16)}
.tally::before{content:"";width:9px;height:9px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor;animation:blink 1.6s infinite}
@keyframes blink{50%{opacity:.35}}
.mbd{position:relative;border-radius:14px;padding:8px;background:linear-gradient(180deg,#1a2442,#0a1126);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.mbd .pn{position:relative;border-radius:8px;background:#02050e;padding:12px 12px 10px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;overflow:hidden;min-height:116px}
.mbd .pn::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,transparent 1.2px,rgba(2,5,14,.55) 1.7px);background-size:4px 4px}
.mbd .tm,.mbd .sub,.mbd .led{position:relative;z-index:2}
.mbd .tm{font-family:'Anybody';font-weight:900;font-size:16px;letter-spacing:.06em;color:var(--led);text-shadow:0 0 10px rgba(159,208,242,.8);text-align:center}
.mbd .big{font-size:64px}
.mbd .sub{grid-column:1/-1;text-align:center;font-family:'Geist Mono';font-size:15px;letter-spacing:.14em;color:var(--led);text-shadow:0 0 8px rgba(159,208,242,.8)}
.mbd .lst{grid-column:1/-1;position:relative;z-index:2;display:flex;justify-content:center}
.sb .lst{display:flex;justify-content:center}
/* (no chip: only its screen-reader line, out of the layout) */
.lst:not(:has(.mp-sync)){display:contents}
/* while «GOOOL» flashes the chip steps aside (its screen-reader line stays) */
.pn:has(.gfx) .lst{display:contents}
.pn:has(.gfx) .lst .mp-sync{display:none}
.mbd .gfx2{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;z-index:2}
.mbd .gfx2 b{font-family:'Anybody';font-weight:900;font-size:56px;line-height:1;color:#ffd98c;text-shadow:0 0 22px rgba(255,198,89,.95);letter-spacing:.08em}
.mbd .gfx2 span{font-family:'Geist Mono';font-size:14px;letter-spacing:.1em;color:#ffd98c;text-align:center}
.lvb{flex:1;min-height:0;overflow:auto;padding:12px 16px}
.lvb h3{font-size:14px;font-weight:600;color:var(--muted);margin-bottom:6px}
.mpads{flex:0 0 auto;padding:12px 16px 16px;border-top:1px solid var(--pline)}
/* mobile match workspace: header merged with tabs */
.mw{flex:0 0 auto;padding:6px 12px 10px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--pline);background:var(--stick)}
.v2f:not([data-theme=light]) .mw{background:#060d24}
.mw .r1{display:flex;align-items:center;gap:10px;min-height:48px}
.mw .r1 .tt{min-width:0;flex:1}
.mw .r1 .tt small{display:block;font-size:13px;color:var(--muted)}
.mw .r1 .tt b{display:flex;align-items:center;gap:8px;font-family:'Anybody';font-weight:900;font-size:20px;white-space:nowrap}
.mtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:3px;border-radius:12px;background:var(--panel)}
.mtabs button{height:40px;border-radius:9px;font-size:13px;font-weight:600;color:var(--soft);display:flex;align-items:center;justify-content:center;gap:4px}
.mtabs button[aria-selected=true]{background:var(--chip);color:var(--ink);box-shadow:inset 0 -2px 0 var(--sky)}
.m .db{padding:12px 16px 16px}
.m .acta{grid-template-columns:1fr}
.m .gr{grid-template-columns:54px minmax(0,1fr) auto}
.m .gr .m{height:44px}
.m .evg{grid-template-columns:1fr}
.m .fgs{grid-template-columns:1fr}
.m .pubg{grid-template-columns:1fr}
.m .df{padding:10px 16px 14px;flex-wrap:wrap}
.m .df .btn{flex:1}
.m .df .st{flex:1 0 100%}
.m .mr{min-height:64px}
.m .ml{border-radius:0;background:none;box-shadow:none;padding:0}
.m .pool{padding-right:0}
.m .pool h3{background:var(--stick)}
.v2f.m:not([data-theme=light]) .pool h3{background:#040a1d}
.m .wall{padding:4px 12px 16px;border-radius:18px}
.m .wall .pegs{gap:4px;justify-content:space-between}
.m .wall .peg{width:104px}
.m .md{width:auto;left:16px;right:16px;margin-left:0}
.mcv{display:flex;flex-direction:column;gap:10px}
.msticky{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--pline)}
.msticky .why{flex:1;font-size:13px;color:var(--muted)}
.mfil{display:flex;gap:8px;overflow-x:auto;flex:0 0 auto}

/* ── additions ── */
.vit .stk{top:-6px;right:-2px;flex-direction:row}
.pubv.still,.pubv.still *,.pubv.still *::before{animation:none!important}
.cab .k{font-family:'Geist',system-ui,sans-serif;letter-spacing:0}
.m .wall{flex:none;overflow:visible}
.bqi+.bqi::before{content:" · "}
.msc>*{flex-shrink:0}
.m .msc .tg>*,.m .msc .cpg>*,.m .msc .prg>*{flex-shrink:0}
.rec .k{font-family:'Geist',system-ui,sans-serif}
.jshelf .ved{height:36px}
.troph{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.troph div{position:relative;border-radius:14px;padding:12px 14px 12px 16px;background:linear-gradient(180deg,rgba(255,217,140,.12),rgba(255,217,140,.03));box-shadow:inset 0 0 0 1px rgba(255,217,140,.25);display:flex;flex-direction:column;gap:2px}
.troph small{font-size:13px;color:#ffd98c;font-weight:600}
.troph b{font-family:'Anybody';font-weight:900;font-size:20px;line-height:1.1}
.troph span{font-size:13px;color:#c9d8ef}
.newS b{display:flex;align-items:center;gap:8px}
.newS{width:100%}
.cpg{align-items:start}.rules{align-self:start}
.capA{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.capA .mem{grid-template-columns:72px minmax(0,1fr);padding:18px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line)}
.capA .mem .ac{grid-column:1/-1}
.capA .pic{width:68px;height:68px;font-size:20px}
.capA .arm{height:28px;padding:0 12px;font-size:16px;left:-10px;bottom:-6px}
.owners{position:relative;border-radius:20px;padding:6px 20px 16px;background:var(--wall);box-shadow:inset 0 0 0 1px var(--wall-line)}
.owners .pegs{justify-content:space-between}
.owners .peg{width:80px}
.owners .lbr{position:relative;margin:14px 0 4px;font-size:14px;font-weight:600;color:var(--soft)}
.rdrs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rdrs div,.rdrs a{padding:12px 14px;border-radius:14px;background:var(--panel);font-size:14px;color:var(--soft);display:flex;flex-direction:column;gap:2px}
.rdrs b{color:var(--ink);display:flex;align-items:center;gap:6px}
.rdrs b svg{color:var(--accent)}
/* «La pizarra» is a way out to its board: a link card (underlined name, accent edge on hover / focus) */
.rdrs a{text-decoration:none;box-shadow:inset 0 0 0 1px var(--pline)}
.rdrs a b{text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 35%,transparent);text-underline-offset:.2em}
.rdrs a:hover,.rdrs a:focus-visible{box-shadow:inset 0 0 0 1.5px var(--accent)}
.rdrs a:hover b,.rdrs a:focus-visible b{text-decoration-color:currentColor}
.pg{grid-template-columns:repeat(5,minmax(0,1fr))}
.lpk .pg{grid-template-columns:repeat(7,minmax(0,1fr))}
.acta{grid-template-columns:minmax(0,1fr) 250px}
.dots .r span b{font-family:'Geist Mono';font-size:13px;white-space:nowrap}
.neu{display:inline-flex;align-items:center;gap:6px;color:var(--soft);font-weight:600;font-size:14px}
.m .capA,.m .troph,.m .rdrs{grid-template-columns:1fr}
.m .owners{display:none}

.dug{gap:16px}
.live2 .pads{grid-auto-rows:76px}.live2 .pad{height:100%}.live2 .pad.fin{height:56px}
.v2f .btn.gold.off{background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1.5px var(--pline);font-weight:600}
.seg2.sm button{height:34px;padding:0 10px;font-size:13px}
.gr input.m{width:100%;border:0;text-align:center;outline:none;padding:0}
.gr input.m:focus{box-shadow:inset 0 0 0 2px var(--sky)}
.gr .gw{display:block;text-align:left;min-width:0;min-height:48px}
.gr.rvl>span{min-width:0}
.peg.nop{padding-top:0;width:72px}.peg.nop::before{display:none}
.sv .peg{width:90px}
.ce .ft{display:flex;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid var(--pline)}
.ce .ft .sp{margin-right:auto}
.pubv .sb{animation:none}
.hd .q span{white-space:nowrap}
.mh h1.t{margin:0}
/* mobile adaptations */
.m .det{border-radius:0;box-shadow:none;background:none;flex:1}
.m .dh{flex-wrap:wrap;padding:8px 12px 10px;gap:8px 10px}
.m .dh .tt b{font-size:20px}
.m .tabs4{margin-left:0;width:100%;display:grid;grid-template-columns:repeat(4,1fr)}
.m .tabs4 button{justify-content:center;padding:0 4px;font-size:13px;gap:4px}
.m .tabs4 .tk.ok{display:none}
.m .msc .scr,.m .ml .scr{overflow:visible}
.m .pal .scr{overflow:auto}
.m .pal{left:12px;right:12px;width:auto;margin-left:0;top:12px;max-height:80%}
.m .lpk{left:12px;right:12px;width:auto;margin-left:0}
.m .drw,.m .ce{position:absolute;left:0;right:0;bottom:0;top:56px;z-index:41;border-radius:22px 22px 0 0;flex:none}
.m .fcg,.m .expl,.m .tg,.m .cpg,.m .prg,.m .prg.wd{grid-template-columns:1fr}
.m .fc{grid-template-columns:88px minmax(0,1fr);gap:12px;padding:14px}
.m .fc .sh{--w:84px!important}
.m .fc h3{font-size:20px}
.m .cover{display:none}
.m .rec{grid-template-columns:repeat(2,1fr)}
.m .jshelf{grid-template-columns:repeat(11,1fr)}
.m .cab{padding:18px 16px}
.m .cab .top{flex-wrap:wrap}.m .cab .top .r{margin-left:0}
.m .cab .top h2{font-size:28px}
.m .mem{grid-template-columns:52px minmax(0,1fr)}.m .mem .ac{grid-column:1/-1}
.m .s7r{padding:18px 8px 10px;gap:2px}.m .s7r .sh{--w:42px!important}.m .s7r .sh i{display:none}.m .s7r .nm{font-size:12px}
.m .acta,.m .tg,.m .cpg,.m .prg{display:flex;flex-direction:column}
.m .cuenta{position:static}
.m .pg{grid-template-columns:repeat(4,1fr)}
.m .mr{grid-template-columns:44px minmax(0,1fr) auto}
.m .pubv{position:relative;inset:auto;flex:1;overflow:auto;padding:18px 16px 20px;gap:12px}
.m .pubv .sb .big{font-size:64px}.m .pubv .sb .pn{padding:12px;gap:8px;grid-template-columns:1fr auto 1fr}.m .pubv .sb .tm{font-size:14px}.m .pubv .sb .tm img,.m .pubv .sb .tm .rc{width:32px;height:32px}
.m .vit .s7 .sh{--w:40px!important}.m .vit .s7 .nm{display:none}.m .vit .pq{font-size:18px}
.m .ho{grid-template-columns:1fr}
.m .shelf .ved{width:22px;height:22px}
.m .mdug .rs span{min-height:30px;font-size:13px;padding:0 10px}
.m .wall .sh{--w:80px}
.m .pool h3{top:-4px}
.m .danger{flex-direction:column;align-items:flex-start}
.mfil{flex:0 0 auto;align-self:flex-start;max-width:100%}
.mfil button{flex:0 0 auto}
@media (prefers-reduced-motion:reduce){.v2f *,.v2f *::before{animation:none!important;transition:none!important}}
`;
