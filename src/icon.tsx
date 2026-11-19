const icons = {
  upload: 'M12 16V4m-5 5 5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  book: 'M12 6v14m0-14C9 4 5 4 3 5v13c3-1 6-1 9 2 3-3 6-3 9-2V5c-2-1-6-1-9 1Z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  play: 'm9 5 11 7-11 7V5Z',
  back: 'm12 5-7 7 7 7m-7-7h14',
  expand: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  check: 'm5 12 4 4L19 6',
  trash: 'M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7',
  moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',
  sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
}

export function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name]} />
    </svg>
  )
}
