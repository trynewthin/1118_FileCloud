import styled from "styled-components";

interface AuroraBackgroundProps {
  className?: string;
  compatMode?: boolean;
}

export function AuroraBackground({ className, compatMode = false }: AuroraBackgroundProps) {
  return (
    <StyledWrapper className={className} $animate={!compatMode}>
      <div className="base" />
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="grid" />
      <div className="vignette" />
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div<{ $animate: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;

  filter: saturate(1.35) contrast(1.15);

  --aurora-base: linear-gradient(135deg, #e9eafc 0%, #fff1f2 100%);
  --aurora-vignette: radial-gradient(circle at center, transparent 66%, rgba(15, 23, 42, 0.18) 100%);

  html.dark & {
    --aurora-base: linear-gradient(135deg, #000000 0%, #0a0520 100%);
    --aurora-vignette: radial-gradient(circle at center, transparent 70%, rgba(10, 5, 32, 0.9) 100%);
  }

  .base {
    position: absolute;
    inset: 0;
    background: var(--aurora-base);
    z-index: 0;
  }

  .blob {
    position: absolute;
    width: 120vmax;
    height: 120vmax;
    border-radius: 9999px;
    filter: blur(90px);
    opacity: 0.98;
    mix-blend-mode: normal;
    will-change: transform;
    z-index: 1;

    html.dark & {
      opacity: 0.82;
      mix-blend-mode: screen;
    }
  }

  .blob-1 {
    top: -55vmax;
    left: -55vmax;
    background: radial-gradient(circle at 30% 30%, rgba(225, 129, 255, 0.55) 0%, transparent 62%);
    ${({ $animate }) => ($animate ? "animation: aurora-blob-1 18s infinite alternate ease-in-out;" : "")}
  }

  .blob-2 {
    top: -40vmax;
    right: -60vmax;
    background: radial-gradient(circle at 60% 40%, rgba(31, 255, 250, 0.46) 0%, transparent 64%);
    opacity: 0.78;
    ${({ $animate }) => ($animate ? "animation: aurora-blob-2 22s infinite alternate ease-in-out;" : "")}
  }

  .blob-3 {
    bottom: -60vmax;
    left: -35vmax;
    background: radial-gradient(circle at 50% 60%, rgba(0, 191, 255, 0.42) 0%, transparent 66%);
    opacity: 0.72;
    ${({ $animate }) => ($animate ? "animation: aurora-blob-3 26s infinite alternate ease-in-out;" : "")}
  }

  @supports (background: color-mix(in oklch, black 50%, transparent)) {
    .blob-1 {
      background: radial-gradient(
        circle at 30% 30%,
        color-mix(in oklch, var(--chart-4, #e181ff) 85%, transparent) 0%,
        transparent 62%
      );
    }

    .blob-2 {
      background: radial-gradient(
        circle at 60% 40%,
        color-mix(in oklch, var(--info, #1ffffa) 82%, transparent) 0%,
        transparent 64%
      );
    }

    .blob-3 {
      background: radial-gradient(
        circle at 50% 60%,
        color-mix(in oklch, var(--chart-2, #00bfff) 78%, transparent) 0%,
        transparent 66%
      );
    }
  }

  .grid {
    position: absolute;
    inset: -50%;
    background: repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.02) 0px,
        rgba(255, 255, 255, 0.02) 1px,
        transparent 1px,
        transparent 40px
      ),
      repeating-linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.03) 0px,
        rgba(255, 255, 255, 0.03) 1px,
        transparent 1px,
        transparent 60px
      );
    mix-blend-mode: overlay;
    opacity: 0.7;
    z-index: 2;
    html.dark & {
      opacity: 0.55;
    }
    ${({ $animate }) => ($animate ? "animation: grid-shift 20s linear infinite;" : "")}
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: var(--aurora-vignette);
    z-index: 3;
    ${({ $animate }) => ($animate ? "animation: aurora-pulse 8s infinite alternate;" : "")}
  }

  @keyframes aurora-blob-1 {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      transform: translate3d(10vmax, 6vmax, 0) scale(1.12);
    }
    100% {
      transform: translate3d(4vmax, -8vmax, 0) scale(1.04);
    }
  }

  @keyframes aurora-blob-2 {
    0% {
      transform: translate3d(0, 0, 0) scale(1.02);
    }
    50% {
      transform: translate3d(-14vmax, 8vmax, 0) scale(1.16);
    }
    100% {
      transform: translate3d(-6vmax, -10vmax, 0) scale(1.06);
    }
  }

  @keyframes aurora-blob-3 {
    0% {
      transform: translate3d(0, 0, 0) scale(1.04);
    }
    50% {
      transform: translate3d(12vmax, -8vmax, 0) scale(1.18);
    }
    100% {
      transform: translate3d(5vmax, 10vmax, 0) scale(1.08);
    }
  }

  @keyframes grid-shift {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(-50%, -50%);
    }
  }

  @keyframes aurora-pulse {
    0% {
      opacity: 0.85;
      transform: scale(1);
    }
    50% {
      opacity: 0.55;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.85;
      transform: scale(1);
    }
  }`;
