import { useId } from "react";
import type { AgentRole, AgentStatus } from "@/lib/types";
import { ROLES } from "@/lib/skills";

/**
 * Personaggi vettoriali degli agenti: robottini con visore, espressioni
 * per stato (lavora / aspetta / errore / libero) e un accessorio per ruolo.
 */

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const NO_ANTENNA: AgentRole[] = ["chief", "design", "frontend", "data", "devops", "backend"];

export function Sprite({ role, status = "idle", size = 44, className = "" }: { role: AgentRole; status?: AgentStatus; size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = ROLES[role].color;
  const light = mix(c, "#ffffff", 0.45);
  const dark = mix(c, "#000000", 0.32);
  const darker = mix(c, "#000000", 0.55);
  const eye = status === "error" ? "#fb7185" : mix(c, "#ffffff", 0.72);
  const working = status === "working";
  const anim = working ? "bot-work" : status === "error" ? "sprite-err" : status === "waiting" ? "floaty-sm" : "sprite-idle";

  const eyeY = status === "waiting" ? 30.5 : 32;
  const eyeH = working ? 5 : 7;

  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={(size * 72) / 64}
      className={`${anim} ${className}`}
      style={{ overflow: "visible", filter: `drop-shadow(0 6px 12px ${c}55)` }}
      role="img"
      aria-label={`${ROLES[role].name}, ${ROLES[role].label}`}
    >
      <defs>
        <linearGradient id={`body${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={c} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`face${uid}`} cx="0.5" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#1a2647" />
          <stop offset="1" stopColor="#060a15" />
        </radialGradient>
      </defs>

      {/* ombra */}
      <ellipse cx="32" cy="68" rx="15" ry="3" fill="#000" opacity="0.4" />

      {/* antenna */}
      {!NO_ANTENNA.includes(role) && (
        <g>
          <line x1="32" y1="20" x2="32" y2="10.5" stroke={dark} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="8.5" r="3.4" fill={light} className={working ? "led-pulse" : ""} style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
        </g>
      )}

      {/* piedi */}
      <rect x="20" y="56" width="9" height="9" rx="4.5" fill={darker} />
      <rect x="35" y="56" width="9" height="9" rx="4.5" fill={darker} />

      {/* braccia */}
      <g className={working ? "bot-type-l" : ""}>
        <rect x="7.5" y="35" width="9" height="15" rx="4.5" fill={dark} />
      </g>
      <g className={working ? "bot-type-r" : ""}>
        <rect x="47.5" y="35" width="9" height="15" rx="4.5" fill={dark} />
      </g>

      {/* corpo */}
      <rect x="13" y="18.5" width="38" height="42" rx="17" fill={`url(#body${uid})`} />
      <rect x="13" y="18.5" width="38" height="42" rx="17" fill="none" stroke="#fff" strokeOpacity="0.18" />
      <ellipse cx="21.5" cy="25" rx="6" ry="3.2" fill="#fff" opacity="0.32" transform="rotate(-28 21.5 25)" />

      {/* visore */}
      <rect x="18" y="25.5" width="28" height="19.5" rx="9.5" fill={`url(#face${uid})`} stroke={light} strokeOpacity="0.45" strokeWidth="1" />

      {/* occhi */}
      {status === "error" ? (
        <g stroke={eye} strokeWidth="2" strokeLinecap="round">
          <path d="M23 32 l5 5 M28 32 l-5 5" />
          <path d="M36 32 l5 5 M41 32 l-5 5" />
        </g>
      ) : (
        <g className="bot-blink">
          <rect x="23" y={eyeY} width="5" height={eyeH} rx="2.5" fill={eye} style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
          <rect x="36" y={eyeY} width="5" height={eyeH} rx="2.5" fill={eye} style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
          <circle cx="26.6" cy={eyeY + 1.6} r="0.9" fill="#fff" />
          <circle cx="39.6" cy={eyeY + 1.6} r="0.9" fill="#fff" />
        </g>
      )}

      {/* bocca */}
      {status === "error" ? (
        <path d="M27.5 42 q1.5 -1.5 3 0 q1.5 1.5 3 0 q1.5 -1.5 3 0" stroke={eye} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      ) : status === "waiting" ? (
        <circle cx="32" cy="41.5" r="1.4" fill={eye} />
      ) : (
        <path d="M28.5 40.5 Q32 43.5 35.5 40.5" stroke={eye} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      )}

      {/* guance e pancia */}
      <ellipse cx="19.5" cy="48" rx="2.6" ry="1.5" fill="#fb7185" opacity="0.35" />
      <ellipse cx="44.5" cy="48" rx="2.6" ry="1.5" fill="#fb7185" opacity="0.35" />
      <circle cx="32" cy="52" r="2.6" fill={light} opacity="0.9" className={working ? "led-pulse" : ""} />

      <Accessory role={role} c={c} light={light} />
    </svg>
  );
}

function Accessory({ role, c, light }: { role: AgentRole; c: string; light: string }) {
  switch (role) {
    case "chief":
      return (
        <g>
          <polygon points="20,20 22.5,8 27.5,14.5 32,5 36.5,14.5 41.5,8 44,20" fill="#fde047" stroke="#b45309" strokeWidth="0.9" strokeLinejoin="round" />
          <circle cx="32" cy="15" r="1.6" fill="#ef4444" />
          <circle cx="25" cy="16" r="1.1" fill="#38bdf8" />
          <circle cx="39" cy="16" r="1.1" fill="#38bdf8" />
        </g>
      );
    case "analyst":
      return (
        <g fill="none" stroke="#e2e8f0" strokeWidth="1.6">
          <circle cx="25.5" cy="35" r="5.6" />
          <circle cx="38.5" cy="35" r="5.6" />
          <path d="M31.1 34.5 h1.8" />
        </g>
      );
    case "triage":
      return (
        <g>
          <path d="M14.5 33 Q14.5 13 32 13 Q49.5 13 49.5 33" stroke="#0f172a" strokeWidth="3" fill="none" />
          <rect x="10" y="29" width="6.5" height="11" rx="3.2" fill="#1e293b" stroke={light} strokeOpacity="0.5" />
          <path d="M13 39.5 Q14 49 23 49" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="49" r="2" fill={light} />
        </g>
      );
    case "design":
      return (
        <g>
          <ellipse cx="30" cy="19" rx="15.5" ry="5.6" fill="#7c3aed" transform="rotate(-9 30 19)" />
          <ellipse cx="27" cy="17" rx="7" ry="1.8" fill="#a78bfa" opacity="0.6" transform="rotate(-9 27 17)" />
          <circle cx="31" cy="12.5" r="2.1" fill="#7c3aed" />
          <rect x="54" y="30" width="2.6" height="15" rx="1.3" fill="#fbbf24" transform="rotate(20 55 37)" />
          <circle cx="58.5" cy="29" r="2.4" fill="#f472b6" />
        </g>
      );
    case "frontend":
      return (
        <g>
          <path d="M15 24 Q16 10 32 10 Q48 10 49 24 Z" fill="#1d4ed8" />
          <path d="M41 22 Q53 21.5 59 24.5 Q51 27 41 25 Z" fill="#1e3a8a" />
          <circle cx="32" cy="16" r="2.2" fill="#93c5fd" />
        </g>
      );
    case "backend":
      return (
        <g>
          <path d="M12.5 31 Q12.5 11 32 11 Q51.5 11 51.5 31" stroke="#1e1b4b" strokeWidth="3.6" fill="none" />
          <rect x="7" y="27" width="8.5" height="13" rx="4" fill="#312e81" stroke={light} strokeOpacity="0.5" />
          <rect x="48.5" y="27" width="8.5" height="13" rx="4" fill="#312e81" stroke={light} strokeOpacity="0.5" />
        </g>
      );
    case "data":
      return (
        <g>
          <path d="M15 23 Q15.5 8.5 32 8.5 Q48.5 8.5 49 23 Z" fill="#f59e0b" />
          <rect x="11" y="21" width="42" height="4.2" rx="2.1" fill="#d97706" />
          <rect x="30.5" y="9" width="3" height="12" rx="1.5" fill="#fcd34d" />
        </g>
      );
    case "seo":
      return (
        <g>
          <path d="M54 37 L63 31 L63 49 L54 43 Z" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="51" y="37.5" width="4" height="5" rx="1" fill="#f59e0b" />
          <path d="M65.5 36 q2 4 0 8" stroke="#fde68a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      );
    case "mobile":
      return (
        <g>
          <rect x="1" y="34" width="10" height="17" rx="2.4" fill="#0f172a" stroke="#e2e8f0" strokeWidth="0.9" />
          <rect x="2.6" y="36.5" width="6.8" height="11" rx="1" fill={light} opacity="0.8" />
        </g>
      );
    case "game":
      return (
        <g>
          <rect x="18" y="47" width="28" height="11" rx="5.5" fill="#1e1b2e" stroke={light} strokeOpacity="0.6" />
          <path d="M23.5 52.5 h5 M26 50 v5" stroke="#e2e8f0" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="38" cy="51" r="1.4" fill="#f43f5e" />
          <circle cx="41.5" cy="54" r="1.4" fill="#facc15" />
        </g>
      );
    case "qa":
      return (
        <g>
          <circle cx="56" cy="35" r="6.2" fill="#67e8f9" fillOpacity="0.2" stroke="#e2e8f0" strokeWidth="2" />
          <path d="M51.8 39.8 L47 46" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="54" cy="33" rx="2" ry="1" fill="#fff" opacity="0.6" />
        </g>
      );
    case "devops":
      return (
        <g>
          <rect x="13" y="20" width="38" height="4.5" rx="2.2" fill="#334155" />
          <circle cx="25" cy="21.5" r="4.4" fill="#f97316" stroke="#e2e8f0" strokeWidth="1.1" />
          <circle cx="39" cy="21.5" r="4.4" fill="#f97316" stroke="#e2e8f0" strokeWidth="1.1" />
          <circle cx="23.8" cy="20.3" r="1.2" fill="#fff" opacity="0.7" />
          <circle cx="37.8" cy="20.3" r="1.2" fill="#fff" opacity="0.7" />
          <path d="M32 49 l2.5 4 h-5 z" fill="#fff" opacity="0.85" />
        </g>
      );
    default:
      return <circle cx="32" cy="14" r="2" fill={c} />;
  }
}
