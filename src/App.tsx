import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 26;

const PIECES = [
  { shape: [[1, 1, 1, 1]], color: '#00e5ff' },
  { shape: [[1, 1], [1, 1]], color: '#ffe000' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#cc00ff' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#00ff88' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff2244' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#3366ff' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff8800' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Cell = string | null;
type Board = Cell[][];
type Shape = number[][];
type Piece = { shape: Shape; color: string; x: number; y: number };
type GS = { board: Board; piece: Piece; next: Piece; score: number; lines: number; over: boolean };

// ── Pure game helpers ─────────────────────────────────────────────────────────

const mkBoard = (): Board =>
  Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(null));

const mkPiece = (): Piece => {
  const t = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: t.shape.map(r => [...r]),
    color: t.color,
    x: Math.floor(COLS / 2) - Math.ceil(t.shape[0].length / 2),
    y: 0,
  };
};

const rotate = (s: Shape): Shape =>
  Array.from({ length: s[0].length }, (_, c) =>
    Array.from({ length: s.length }, (_, r) => s[s.length - 1 - r][c])
  );

const fits = (board: Board, shape: Shape, x: number, y: number): boolean => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  return true;
};

const stamp = (board: Board, p: Piece): Board => {
  const b = board.map(r => [...r]);
  p.shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v && p.y + r >= 0) b[p.y + r][p.x + c] = p.color;
    })
  );
  return b;
};

const sweep = (board: Board): [Board, number] => {
  const kept = board.filter(row => row.some(c => !c));
  const n = ROWS - kept.length;
  return [[...Array.from({ length: n }, () => new Array<Cell>(COLS).fill(null)), ...kept], n];
};

const ghostY = (board: Board, p: Piece): number => {
  let y = p.y;
  while (fits(board, p.shape, p.x, y + 1)) y++;
  return y;
};

const scoreFor = (n: number) => ([0, 100, 300, 500, 800])[Math.min(n, 4)] ?? 0;

const mkGS = (): GS => ({
  board: mkBoard(), piece: mkPiece(), next: mkPiece(), score: 0, lines: 0, over: false,
});

// ── useGame hook ──────────────────────────────────────────────────────────────

function useGame(active: boolean) {
  const ref = useRef<GS>(mkGS());
  const [snap, setSnap] = useState<GS>(() => ref.current);
  const push = useCallback(() => setSnap({ ...ref.current }), []);

  const place = useCallback((s: GS): GS => {
    const [cleared, n] = sweep(stamp(s.board, s.piece));
    const p2 = s.next, p3 = mkPiece();
    return {
      board: cleared, piece: p2, next: p3,
      score: s.score + scoreFor(n), lines: s.lines + n,
      over: !fits(cleared, p2.shape, p2.x, p2.y),
    };
  }, []);

  const tick = useCallback(() => {
    const s = ref.current;
    if (s.over) return;
    if (fits(s.board, s.piece.shape, s.piece.x, s.piece.y + 1)) {
      ref.current = { ...s, piece: { ...s.piece, y: s.piece.y + 1 } };
    } else {
      ref.current = place(s);
    }
    push();
  }, [place, push]);

  const left = useCallback(() => {
    const s = ref.current;
    if (s.over || !fits(s.board, s.piece.shape, s.piece.x - 1, s.piece.y)) return;
    ref.current = { ...s, piece: { ...s.piece, x: s.piece.x - 1 } };
    push();
  }, [push]);

  const right = useCallback(() => {
    const s = ref.current;
    if (s.over || !fits(s.board, s.piece.shape, s.piece.x + 1, s.piece.y)) return;
    ref.current = { ...s, piece: { ...s.piece, x: s.piece.x + 1 } };
    push();
  }, [push]);

  const rotP = useCallback(() => {
    const s = ref.current;
    if (s.over) return;
    const rotated = rotate(s.piece.shape);
    for (const dx of [0, -1, 1, -2, 2]) {
      if (fits(s.board, rotated, s.piece.x + dx, s.piece.y)) {
        ref.current = { ...s, piece: { ...s.piece, shape: rotated, x: s.piece.x + dx } };
        push();
        return;
      }
    }
  }, [push]);

  const drop = useCallback(() => {
    const s = ref.current;
    if (s.over) return;
    const gy = ghostY(s.board, s.piece);
    ref.current = place({ ...s, piece: { ...s.piece, y: gy } });
    push();
  }, [place, push]);

  const reset = useCallback(() => {
    ref.current = mkGS();
    push();
  }, [push]);

  useEffect(() => {
    if (!active) return;
    let id: number;
    const loop = () => {
      if (ref.current.over) return;
      const lvl = Math.floor(ref.current.lines / 10);
      const delay = Math.max(80, 500 - lvl * 45);
      id = window.setTimeout(() => { tick(); loop(); }, delay);
    };
    loop();
    return () => clearTimeout(id);
  }, [active, tick]);

  return { snap, left, right, rotP, drop, reset };
}

// ── BoardView ─────────────────────────────────────────────────────────────────

function BoardView({ snap, color, leading }: { snap: GS; color: string; leading: boolean }) {
  const gy = snap.over ? -999 : ghostY(snap.board, snap.piece);
  const ghostSet = new Set<number>();
  if (!snap.over) {
    snap.piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && gy + r >= 0) ghostSet.add((gy + r) * COLS + snap.piece.x + c);
      })
    );
  }
  const displayed = snap.over ? snap.board : stamp(snap.board, snap.piece);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: '1px',
          background: '#080018',
          border: `2px solid ${color}`,
          boxShadow: leading
            ? `0 0 20px ${color}, 0 0 70px ${color}55, 0 0 140px ${color}22`
            : `0 0 5px ${color}33`,
          transition: 'box-shadow 0.5s ease',
        }}
      >
        {Array.from({ length: ROWS * COLS }, (_, idx) => {
          const row = Math.floor(idx / COLS), col = idx % COLS;
          const cell = displayed[row][col];
          const isGhost = !cell && ghostSet.has(idx);
          return (
            <div
              key={idx}
              style={{
                width: CELL,
                height: CELL,
                background: cell
                  ? cell
                  : isGhost
                  ? `${snap.piece.color}18`
                  : '#05001099',
                border: cell
                  ? `1px solid ${cell}bb`
                  : isGhost
                  ? `1px solid ${snap.piece.color}44`
                  : '1px solid #ffffff07',
                boxShadow: cell ? `inset 0 0 6px ${cell}55, 0 0 4px ${cell}33` : 'none',
              }}
            />
          );
        })}
      </div>
      {snap.over && (
        <div
          style={{
            position: 'absolute', inset: 0, background: '#000000cc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 18, fontWeight: 900,
              color, textShadow: `0 0 20px ${color}`,
              letterSpacing: '0.08em',
            }}
          >
            GAME OVER
          </div>
        </div>
      )}
    </div>
  );
}

// ── NextPreview ───────────────────────────────────────────────────────────────

function NextPreview({ piece }: { piece: Piece }) {
  const SZ = 4, CS = 14;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SZ}, ${CS}px)`, gap: '1px' }}>
      {Array.from({ length: SZ * SZ }, (_, i) => {
        const r = Math.floor(i / SZ) - Math.floor((SZ - piece.shape.length) / 2);
        const c = (i % SZ) - Math.floor((SZ - piece.shape[0].length) / 2);
        const on = piece.shape[r]?.[c];
        return (
          <div
            key={i}
            style={{
              width: CS, height: CS,
              background: on ? piece.color : '#04000e88',
              border: '1px solid #ffffff06',
              boxShadow: on ? `0 0 4px ${piece.color}88` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

// ── PlayerPanel ───────────────────────────────────────────────────────────────

function PlayerPanel({
  snap, color, leading, name, controls,
}: {
  snap: GS; color: string; leading: boolean; name: string; controls: string[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          fontFamily: 'Orbitron, monospace', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.22em',
          color: leading ? color : '#ffffff77',
          textShadow: leading ? `0 0 14px ${color}, 0 0 30px ${color}66` : 'none',
          transition: 'color 0.5s, text-shadow 0.5s',
          minHeight: 18,
        }}
      >
        {name}{leading ? ' ◆' : ''}
      </div>

      <BoardView snap={snap} color={color} leading={leading} />

      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        <div>
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 7, letterSpacing: '0.25em',
              color: '#ffffff77', marginBottom: 5,
            }}
          >
            NEXT
          </div>
          <NextPreview piece={snap.next} />
        </div>
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 7, letterSpacing: '0.25em', color: '#ffffff77' }}>
            SCORE
          </div>
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 19, fontWeight: 900,
              color: leading ? color : '#ffffffaa',
              textShadow: leading ? `0 0 10px ${color}` : 'none',
              letterSpacing: '0.04em',
              transition: 'color 0.5s',
              minWidth: 90,
            }}
          >
            {String(snap.score).padStart(6, '0')}
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 7, letterSpacing: '0.25em', color: '#ffffff77', marginTop: 6 }}>
            LINES
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#ffffff99' }}>
            {snap.lines}
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 7, letterSpacing: '0.25em', color: '#ffffff77', marginTop: 6 }}>
            LEVEL
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#ffffff99' }}>
            {Math.floor(snap.lines / 10) + 1}
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: 'Rajdhani, sans-serif', fontSize: 10,
          color: '#ffffff77', letterSpacing: '0.1em',
          textAlign: 'center', lineHeight: 1.9,
        }}
      >
        {controls.map((c, i) => <div key={i}>{c}</div>)}
      </div>
    </div>
  );
}

// ── Landing Screen ────────────────────────────────────────────────────────────

const mkCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function Landing({ onStart }: { onStart: (code: string) => void }) {
  const [code] = useState(mkCode);
  const [inp, setInp] = useState('');
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #1c0040 0%, #06000f 70%)',
        fontFamily: 'Rajdhani, sans-serif',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(#ff00ff09 1px, transparent 1px), linear-gradient(90deg, #ff00ff09 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      {/* Glow orbs */}
      <div
        style={{
          position: 'absolute', top: '10%', left: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: '#6600ff14', filter: 'blur(120px)', pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: '#ff006614', filter: 'blur(120px)', pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 'clamp(52px, 8vw, 84px)', fontWeight: 900,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #ff00cc 0%, #8800ff 45%, #00ccff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            TETRIS
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 'clamp(18px, 3vw, 32px)', fontWeight: 300,
              letterSpacing: '0.85em',
              color: '#ff00cc',
              textShadow: '0 0 24px #ff00cc88, 0 0 60px #ff00cc33',
              marginTop: 2,
            }}
          >
            RACE
          </div>
        </div>

        <div style={{ color: '#ffffff99', fontSize: 12, letterSpacing: '0.28em' }}>
          2-PLAYER LOCAL BATTLE
        </div>

        {/* Mode: home */}
        {mode === 'home' && (
          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            <NeonButton color="#ff00cc" onClick={() => setMode('create')}>CREATE ROOM</NeonButton>
            <NeonButton color="#00ccff" onClick={() => setMode('join')}>JOIN ROOM</NeonButton>
          </div>
        )}

        {/* Mode: create */}
        {mode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ color: '#ffffff99', fontSize: 11, letterSpacing: '0.25em' }}>YOUR ROOM CODE</div>
            <div
              style={{
                fontFamily: 'Orbitron', fontSize: 54, fontWeight: 900, letterSpacing: '0.45em',
                color: '#ff00cc', textShadow: '0 0 20px #ff00cc, 0 0 60px #ff00cc44',
                border: '2px solid #ff00cc44', padding: '10px 28px',
              }}
            >
              {code}
            </div>
            <div style={{ color: '#ffffff88', fontSize: 11, letterSpacing: '0.12em' }}>
              Both players share this device
            </div>
            <GradientButton onClick={() => onStart(code)}>START BATTLE</GradientButton>
            <button
              onClick={() => setMode('home')}
              style={{
                fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.18em',
                padding: '6px 16px', cursor: 'pointer',
                background: 'transparent', border: '1px solid #ffffff18', color: '#ffffff99',
              }}
            >
              BACK
            </button>
          </div>
        )}

        {/* Mode: join */}
        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ color: '#ffffff99', fontSize: 11, letterSpacing: '0.25em' }}>ENTER ROOM CODE</div>
            <input
              value={inp}
              onChange={e => setInp(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4))}
              placeholder="XXXX"
              maxLength={4}
              style={{
                fontFamily: 'Orbitron', fontSize: 44, fontWeight: 900, letterSpacing: '0.5em',
                color: '#00ccff', background: 'transparent',
                border: '2px solid #00ccff44', padding: '10px 20px',
                textAlign: 'center', outline: 'none', width: 240,
                caretColor: '#00ccff',
              }}
            />
            <GradientButton
              onClick={() => inp.length === 4 && onStart(inp)}
              disabled={inp.length < 4}
              colorB="#0044ff"
              colorA="#00ccff"
            >
              JOIN BATTLE
            </GradientButton>
            <button
              onClick={() => setMode('home')}
              style={{
                fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.18em',
                padding: '6px 16px', cursor: 'pointer',
                background: 'transparent', border: '1px solid #ffffff18', color: '#ffffff99',
              }}
            >
              BACK
            </button>
          </div>
        )}

        {/* Controls preview */}
        <div style={{ display: 'flex', gap: 48, marginTop: 4 }}>
          {[
            {
              label: 'PLAYER 1', color: '#ff00cc',
              keys: [['A / D', 'Move left / right'], ['W', 'Rotate'], ['S', 'Hard drop']],
            },
            {
              label: 'PLAYER 2', color: '#00ccff',
              keys: [['← →', 'Move left / right'], ['↑', 'Rotate'], ['↓', 'Hard drop']],
            },
          ].map(({ label, color, keys }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: 'Orbitron', fontSize: 8, letterSpacing: '0.28em',
                  color: `${color}88`, marginBottom: 10,
                }}
              >
                {label}
              </div>
              {keys.map(([k, v]) => (
                <div
                  key={k}
                  style={{ display: 'flex', gap: 10, marginBottom: 5, alignItems: 'center' }}
                >
                  <span
                    style={{
                      fontFamily: 'Orbitron', fontSize: 10,
                      color: `${color}aa`, minWidth: 46,
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ fontSize: 12, color: '#ffffff88' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function NeonButton({
  color, onClick, children,
}: {
  color: string; onClick: () => void; children: ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: 'Orbitron', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em',
        padding: '12px 26px', cursor: 'pointer',
        background: hov ? `${color}18` : 'transparent',
        color, border: `2px solid ${color}`,
        boxShadow: hov ? `0 0 30px ${color}88` : `0 0 12px ${color}44`,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

function GradientButton({
  onClick, children, disabled = false,
  colorA = '#8800ff', colorB = '#ff00cc',
}: {
  onClick: () => void; children: ReactNode;
  disabled?: boolean; colorA?: string; colorB?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'Orbitron', fontWeight: 900, fontSize: 13, letterSpacing: '0.22em',
        padding: '13px 40px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'transparent' : `linear-gradient(90deg, ${colorA}, ${colorB})`,
        color: disabled ? '#ffffff88' : '#fff',
        border: disabled ? '2px solid #ffffff66' : 'none',
        boxShadow: disabled ? 'none' : `0 0 30px ${colorB}55, 0 0 60px ${colorA}33`,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────

type Phase = 'countdown' | 'playing' | 'done';

function GameScreen({ roomCode, onBack }: { roomCode: string; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);

  const g1 = useGame(phase === 'playing');
  const g2 = useGame(phase === 'playing');

  const { left: l1, right: r1, rotP: rot1, drop: d1, snap: s1, reset: reset1 } = g1;
  const { left: l2, right: r2, rotP: rot2, drop: d2, snap: s2, reset: reset2 } = g2;

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown < 0) { setPhase('playing'); return; }
    const delay = countdown === 0 ? 750 : 1000;
    const t = setTimeout(() => setCountdown(n => n - 1), delay);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Both over → done
  useEffect(() => {
    if (phase === 'playing' && s1.over && s2.over) setPhase('done');
  }, [phase, s1.over, s2.over]);

  // Keyboard
  useEffect(() => {
    if (phase !== 'playing') return;
    const handle = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
        e.preventDefault();
      switch (e.key) {
        case 'a': case 'A': l1(); break;
        case 'd': case 'D': r1(); break;
        case 'w': case 'W': rot1(); break;
        case 's': case 'S': d1(); break;
        case 'ArrowLeft':  l2(); break;
        case 'ArrowRight': r2(); break;
        case 'ArrowUp':    rot2(); break;
        case 'ArrowDown':  d2(); break;
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [phase, l1, r1, rot1, d1, l2, r2, rot2, d2]);

  const rematch = () => {
    reset1(); reset2();
    setCountdown(3); setPhase('countdown');
  };

  const p1Lead = s1.score > s2.score;
  const p2Lead = s2.score > s1.score;
  const winner =
    phase === 'done'
      ? s1.score > s2.score ? 'PLAYER 1' : s2.score > s1.score ? 'PLAYER 2' : 'TIE'
      : null;
  const winColor = winner === 'PLAYER 1' ? '#ff00cc' : winner === 'PLAYER 2' ? '#00ccff' : '#ffffff';

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #0d001f 0%, #040010 60%, #000008 100%)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(#ff00ff07 1px, transparent 1px), linear-gradient(90deg, #ff00ff07 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header */}
      <div
        style={{
          position: 'absolute', top: 16, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 24px', zIndex: 2,
        }}
      >
        <button
          onClick={onBack}
          style={{
            fontFamily: 'Orbitron', fontSize: 9, color: '#ffffff88',
            background: 'transparent', border: '1px solid #ffffff18',
            padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.15em',
          }}
        >
          ← MENU
        </button>
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#ffffff66', letterSpacing: '0.35em' }}>
          TETRIS RACE &nbsp;·&nbsp; ROOM{' '}
          <span style={{ color: '#ffffffaa' }}>{roomCode}</span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Boards */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 24,
          position: 'relative', zIndex: 1, paddingTop: 40,
        }}
      >
        <PlayerPanel
          snap={s1} color="#ff00cc" leading={p1Lead}
          name="PLAYER 1"
          controls={['A / D  ·  Move', 'W  ·  Rotate', 'S  ·  Hard Drop']}
        />

        {/* VS column */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, paddingTop: 90, minWidth: 54,
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 20, fontWeight: 900,
              background: 'linear-gradient(180deg, #ff00cc, #8800ff, #00ccff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '0.04em',
            }}
          >
            VS
          </div>
          <div style={{ width: 1, height: 100, background: 'linear-gradient(#ff00cc44, #00ccff44)' }} />
          {phase === 'playing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.18em',
                  color: p1Lead ? '#ff00ccaa' : '#ff00cc44',
                  transition: 'color 0.4s',
                }}
              >
                {String(s1.score).padStart(5, '0')}
              </div>
              <div
                style={{
                  fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.18em',
                  color: p2Lead ? '#00ccffaa' : '#00ccff44',
                  transition: 'color 0.4s',
                }}
              >
                {String(s2.score).padStart(5, '0')}
              </div>
            </div>
          )}
        </div>

        <PlayerPanel
          snap={s2} color="#00ccff" leading={p2Lead}
          name="PLAYER 2"
          controls={['← →  ·  Move', '↑  ·  Rotate', '↓  ·  Hard Drop']}
        />
      </div>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#00000099', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.45em',
              color: '#ffffff99', marginBottom: 18,
            }}
          >
            GET READY
          </div>
          <div
            key={countdown}
            style={{
              fontFamily: 'Orbitron', fontSize: 120, fontWeight: 900, lineHeight: 1,
              background: 'linear-gradient(135deg, #ff00cc, #8800ff, #00ccff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'pulse 0.5s ease-out',
            }}
          >
            {countdown > 0 ? countdown : 'GO!'}
          </div>
          <style>{`
            @keyframes pulse {
              0% { transform: scale(1.4); opacity: 0.5; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Done overlay */}
      {phase === 'done' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#000000bb', backdropFilter: 'blur(8px)', gap: 22,
          }}
        >
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 10, letterSpacing: '0.45em',
              color: '#ffffff99',
            }}
          >
            GAME OVER
          </div>
          <div
            style={{
              fontFamily: 'Orbitron', fontSize: 38, fontWeight: 900,
              color: winColor, textShadow: `0 0 30px ${winColor}`,
              letterSpacing: '0.06em',
            }}
          >
            {winner === 'TIE' ? 'DRAW!' : `${winner} WINS`}
          </div>
          <div
            style={{
              display: 'flex', gap: 20, fontFamily: 'Orbitron', fontSize: 13,
              letterSpacing: '0.06em',
            }}
          >
            <span style={{ color: '#ff00cc' }}>{String(s1.score).padStart(6, '0')}</span>
            <span style={{ color: '#ffffff66' }}>vs</span>
            <span style={{ color: '#00ccff' }}>{String(s2.score).padStart(6, '0')}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            <GradientButton onClick={rematch}>REMATCH</GradientButton>
            <button
              onClick={onBack}
              style={{
                fontFamily: 'Orbitron', fontWeight: 700, fontSize: 11,
                letterSpacing: '0.18em', padding: '12px 26px', cursor: 'pointer',
                background: 'transparent', color: '#ffffffaa',
                border: '2px solid #ffffff66',
              }}
            >
              MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'game'>('landing');
  const [roomCode, setRoomCode] = useState('');

  if (screen === 'landing') {
    return (
      <Landing
        onStart={code => {
          setRoomCode(code);
          setScreen('game');
        }}
      />
    );
  }

  return <GameScreen roomCode={roomCode} onBack={() => setScreen('landing')} />;
}
