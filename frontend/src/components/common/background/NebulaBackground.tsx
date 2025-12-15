import { useId } from "react";
import styled from "styled-components";

interface NebulaBackgroundProps {
  className?: string;
  compatMode?: boolean;
}

export function NebulaBackground({ className, compatMode = false }: NebulaBackgroundProps) {
  const filterId = useId();

  return (
    <StyledWrapper className={className} $animate={!compatMode} $filterId={filterId}>
      <div className="nebula-pattern">
        <svg height={0} width={0} aria-hidden="true" focusable="false">
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              result="turb"
              seed={11}
              numOctaves={4}
              baseFrequency={0.023}
              type="fractalNoise"
            />
            <feColorMatrix values="110" type="hueRotate" />
            <feGaussianBlur result="blurred" stdDeviation={9} />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0 0.12 0.55 0.92 1" />
            </feComponentTransfer>
            <feBlend in="turb" in2="blurred" mode="screen" />
          </filter>
        </svg>
        <span className="nebula" />
        <span className="vignette" />
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div<{ $animate: boolean; $filterId: string }>`
  position: absolute;
  inset: 0;
  pointer-events: none;

  .nebula-pattern {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(125deg, #1a0a2d 0%, #3542c4 65%, #ffdee9 100%);
    overflow: hidden;
  }

  .nebula {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    filter: ${({ $filterId }) => `url(#${$filterId})`};
    background: radial-gradient(
        circle at 75% 60%,
        rgba(255, 246, 203, 0.18) 0,
        transparent 90%
      ),
      radial-gradient(
        circle at 28% 22%,
        rgba(225, 129, 255, 0.26) 0,
        transparent 65%
      ),
      radial-gradient(
        circle at 60% 80%,
        rgba(31, 255, 250, 0.16) 0,
        transparent 80%
      );
    mix-blend-mode: lighten;
    opacity: 1;
    z-index: 2;
    ${({ $animate }) =>
      $animate
        ? `animation: nebula-drift 18s infinite alternate ease-in-out;`
        : ""}
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, transparent 65%, rgba(10, 5, 32, 0.88) 100%);
    opacity: 0.25;
    z-index: 3;
    ${({ $animate }) => ($animate ? `animation: nebula-pulse 10s infinite alternate;` : "")}
  }

  @keyframes nebula-drift {
    0% {
      transform: translate3d(0, 0, 0) scale(1.02);
    }
    50% {
      transform: translate3d(-2%, 1%, 0) scale(1.06);
    }
    100% {
      transform: translate3d(2%, -1%, 0) scale(1.02);
    }
  }

  @keyframes nebula-pulse {
    0% {
      opacity: 0.28;
    }
    50% {
      opacity: 0.14;
    }
    100% {
      opacity: 0.28;
    }
  }
`;
