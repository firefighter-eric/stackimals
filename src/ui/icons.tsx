import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  'aria-hidden': true,
  focusable: false,
  viewBox: '0 0 24 24',
} as const;

export function PauseIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 5.25v13.5M17 5.25v13.5" />
    </svg>
  );
}

export function RotateLeftIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M5.2 8.2H1.8V4.8" />
      <path d="M3 7a9 9 0 1 1-.2 9.6" />
      <path d="m1.8 8.2 4.6-4.6" />
    </svg>
  );
}

export function RotateRightIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M18.8 8.2h3.4V4.8" />
      <path d="M21 7a9 9 0 1 0 .2 9.6" />
      <path d="m22.2 8.2-4.6-4.6" />
    </svg>
  );
}

export function RestartIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4.3 7.4A9 9 0 1 1 3 14" />
      <path d="M4.3 3.5v3.9H.4" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 2.5c.7 4 2.5 5.8 6.5 6.5-4 .7-5.8 2.5-6.5 6.5C11.3 11.5 9.5 9.7 5.5 9c4-.7 5.8-2.5 6.5-6.5Z" />
      <path d="M19 15.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />
    </svg>
  );
}
