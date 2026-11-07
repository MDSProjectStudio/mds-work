import type { DesignTemplate } from "@/lib/templates";

/** Mini anteprima "wireframe a colori" di ogni template della libreria. */
function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 128;
}

export function TemplatePreview({ t, className = "" }: { t: DesignTemplate; className?: string }) {
  const [a, b, c] = t.palette;
  const dark = isDark(t.bg);
  const ink = dark ? "rgba(255,255,255,.82)" : "rgba(15,23,42,.85)";
  const soft = dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.06)";
  const line = (w: string, h = 4, color = soft) => <div style={{ width: w, height: h, background: color, borderRadius: 99 }} />;
  const grad = `linear-gradient(135deg, ${a}, ${b})`;

  let body: React.ReactNode;
  switch (t.layout) {
    case "landing":
      body = (
        <div className="flex h-full flex-col p-[6%]">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: grad }} />
            {line("12%")} {line("10%")} {line("10%")}
            <div className="ml-auto h-3 w-[14%] rounded-full" style={{ background: a }} />
          </div>
          <div className="mt-[7%] flex flex-1 gap-[6%]">
            <div className="flex flex-1 flex-col gap-1.5 pt-[3%]">
              {line("85%", 9, ink)}
              {line("65%", 9, grad as string)}
              {line("70%", 3)}
              {line("50%", 3)}
              <div className="mt-2 flex gap-1.5">
                <div className="h-3.5 w-[34%] rounded-full" style={{ background: grad, boxShadow: `0 0 14px ${a}88` }} />
                <div className="h-3.5 w-[26%] rounded-full border" style={{ borderColor: soft }} />
              </div>
            </div>
            <div className="relative w-[42%] rounded-lg border" style={{ borderColor: soft, background: soft }}>
              <div className="absolute -inset-3 -z-0 rounded-full blur-2xl" style={{ background: a + "40" }} />
              <div className="relative m-[8%] h-[30%] rounded" style={{ background: grad }} />
              <div className="relative mx-[8%] grid grid-cols-3 gap-1">
                {[0, 1, 2].map((i) => <div key={i} className="h-5 rounded" style={{ background: soft }} />)}
              </div>
            </div>
          </div>
          <div className="mt-[5%] grid grid-cols-3 gap-[3%]">
            {[a, b, c].map((col, i) => <div key={i} className="h-5 rounded-md border" style={{ borderColor: col + "55", background: col + "18" }} />)}
          </div>
        </div>
      );
      break;
    case "dashboard":
      body = (
        <div className="flex h-full">
          <div className="flex w-[20%] flex-col gap-1.5 border-r p-[3%]" style={{ borderColor: soft, background: soft }}>
            <div className="mb-1 h-3 w-3 rounded" style={{ background: grad }} />
            {[1, 0, 0, 0, 0].map((x, i) => <div key={i} className="h-2 rounded" style={{ background: x ? a + "aa" : soft }} />)}
          </div>
          <div className="flex flex-1 flex-col gap-[4%] p-[4%]">
            <div className="flex items-center gap-2">{line("30%", 6, ink)}<div className="ml-auto h-3 w-3 rounded-full" style={{ background: b }} /></div>
            <div className="grid grid-cols-4 gap-[3%]">
              {[a, b, c, a].map((col, i) => (
                <div key={i} className="rounded-md border p-1" style={{ borderColor: soft, background: soft }}>
                  <div className="h-1.5 w-1/2 rounded" style={{ background: col }} />
                  <div className="mt-1 h-2.5 w-3/4 rounded" style={{ background: ink, opacity: 0.6 }} />
                </div>
              ))}
            </div>
            <div className="flex flex-1 gap-[3%]">
              <div className="relative flex-1 overflow-hidden rounded-md border" style={{ borderColor: soft, background: soft }}>
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id={`g-${t.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a} stopOpacity=".5" /><stop offset="1" stopColor={a} stopOpacity="0" /></linearGradient>
                  </defs>
                  <path d="M0 32 C15 28 20 12 35 18 S60 30 70 14 S90 6 100 10 L100 40 L0 40 Z" fill={`url(#g-${t.id})`} />
                  <path d="M0 32 C15 28 20 12 35 18 S60 30 70 14 S90 6 100 10" stroke={a} strokeWidth="1.2" fill="none" />
                </svg>
              </div>
              <div className="grid w-[30%] place-items-center rounded-md border" style={{ borderColor: soft, background: soft }}>
                <div className="h-8 w-8 rounded-full" style={{ background: `conic-gradient(${a} 0 55%, ${b} 55% 80%, ${soft} 80%)`, mask: "radial-gradient(circle, transparent 45%, #000 46%)", WebkitMask: "radial-gradient(circle, transparent 45%, #000 46%)" }} />
              </div>
            </div>
          </div>
        </div>
      );
      break;
    case "shop":
      body = (
        <div className="flex h-full flex-col p-[5%]">
          <div className="flex items-center gap-2">{line("16%", 6, ink)}<div className="ml-auto flex gap-1.5">{line("8%")}{line("8%")}</div><div className="h-3 w-3 rounded-full" style={{ background: a }} /></div>
          <div className="mt-[5%] h-[22%] rounded-lg" style={{ background: `linear-gradient(120deg, ${a}cc, ${b}aa)` }} />
          <div className="mt-[4%] grid flex-1 grid-cols-4 gap-[3%]">
            {[a, b, c, a].map((col, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md p-1" style={{ background: soft }}>
                <div className="flex-1 rounded" style={{ background: `linear-gradient(160deg, ${col}55, ${col}22)` }} />
                {line("80%", 3, ink)}
                <div className="h-2.5 w-1/2 rounded-full" style={{ background: a }} />
              </div>
            ))}
          </div>
        </div>
      );
      break;
    case "portfolio":
      body = (
        <div className="grid h-full grid-cols-4 grid-rows-3 gap-[3%] p-[5%]">
          <div className="col-span-2 row-span-2 flex flex-col justify-end gap-1 rounded-lg p-2" style={{ background: a, color: t.bg }}>
            {line("80%", 7, t.bg)}
            {line("50%", 7, t.bg)}
          </div>
          <div className="rounded-lg" style={{ background: soft }} />
          <div className="rounded-lg" style={{ background: b }} />
          <div className="col-span-2 rounded-lg" style={{ background: soft }} />
          <div className="col-span-2 rounded-lg" style={{ background: `linear-gradient(135deg, ${c}, ${soft})` }} />
          <div className="rounded-lg" style={{ background: soft }} />
          <div className="rounded-lg border" style={{ borderColor: a }} />
        </div>
      );
      break;
    case "editorial":
      body = (
        <div className="flex h-full flex-col p-[6%]">
          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: soft }}>{line("18%", 5, ink)}<div className="flex gap-1.5">{line("8%")}{line("8%")}{line("8%")}</div></div>
          <div className="mt-[5%] flex flex-1 gap-[5%]">
            <div className="flex w-[48%] flex-col gap-1.5">
              {line("95%", 11, ink)}
              {line("70%", 11, ink)}
              <div className="mt-1 h-px w-10" style={{ background: b }} />
              {line("90%", 3)}{line("85%", 3)}{line("60%", 3)}
            </div>
            <div className="flex-1 rounded" style={{ background: `linear-gradient(160deg, ${b}66, ${a}44)` }} />
          </div>
        </div>
      );
      break;
    case "mobile":
      body = (
        <div className="grid h-full place-items-center" style={{ background: `radial-gradient(circle at 50% 30%, ${a}33, transparent 60%)` }}>
          <div className="flex h-[88%] w-[34%] flex-col gap-1.5 rounded-[14px] border-2 p-1.5" style={{ borderColor: "rgba(255,255,255,.25)", background: t.bg }}>
            <div className="mx-auto h-1 w-1/3 rounded-full bg-white/20" />
            <div className="h-[28%] rounded-lg" style={{ background: grad }} />
            {[0, 1].map((i) => <div key={i} className="flex items-center gap-1 rounded-md p-1" style={{ background: soft }}><div className="h-3 w-3 rounded" style={{ background: i ? b : a }} />{line("60%", 3, ink)}</div>)}
            <div className="mt-auto flex justify-around rounded-md p-1" style={{ background: soft }}>{[a, soft, soft, soft].map((col, i) => <div key={i} className="h-2 w-2 rounded-full" style={{ background: col }} />)}</div>
          </div>
        </div>
      );
      break;
    case "game":
      body = (
        <div className="relative h-full p-[5%]" style={{ background: `radial-gradient(circle at 50% 60%, ${c}22, transparent 60%)` }}>
          <div className="flex gap-2">
            <div className="h-2 w-[30%] overflow-hidden rounded-sm bg-white/10"><div className="h-full w-[70%]" style={{ background: a }} /></div>
            <div className="h-2 w-[20%] overflow-hidden rounded-sm bg-white/10"><div className="h-full w-[45%]" style={{ background: c }} /></div>
            <div className="ml-auto h-3 w-8 rounded-sm" style={{ background: b }} />
          </div>
          <div className="mt-[10%] flex flex-col items-center gap-1.5">
            <div className="h-3.5 w-[50%] rounded-sm" style={{ background: `linear-gradient(90deg, ${a}, ${b})`, boxShadow: `0 0 18px ${a}` }} />
            {line("30%", 3, ink)}
            {["58%", "48%", "48%"].map((w, i) => <div key={i} className="mt-1 h-3 rounded-sm border" style={{ width: w, borderColor: i ? "rgba(255,255,255,.2)" : c, background: i ? "transparent" : c + "33" }} />)}
          </div>
          <div className="absolute bottom-[6%] left-[5%] grid grid-cols-4 gap-1">{[a, b, c, a].map((col, i) => <div key={i} className="h-4 w-4 rounded-sm border" style={{ borderColor: col }} />)}</div>
        </div>
      );
      break;
  }

  return (
    <div className={`relative aspect-[16/10] overflow-hidden rounded-xl border border-line2 ${className}`} style={{ background: t.bg }}>
      {body}
    </div>
  );
}
