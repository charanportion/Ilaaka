import { useColorScheme } from 'nativewind';

export function useResolvedColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}

/* CartoDB Positron / Dark Matter — both have neutral, low-saturation
   palettes that read as paper-and-ink, complementing the new monochrome
   chrome. Free to use, served via the basemaps.cartocdn.com CDN. */
const MAP_STYLE_LIGHT =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAP_STYLE_DARK =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function useMapStyleUrl(): string {
  return useResolvedColorScheme() === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
