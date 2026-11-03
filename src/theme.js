import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F6EFF0',
  panel: '#FFFAFA',
  panel2: '#F9F0F1',
  line: '#ECD9DC',
  fg: '#2A1A1E',
  muted: '#836B71',
  accent: '#C1274F',
  onAccent: '#FFFFFF',
  out: '#FBD5DD',
  outInk: '#3A1520',
  incoming: '#FFFFFF',
  tick: '#2A8FD6',
  statusBar: 'dark-content',
};

export const dark = {
  bg: '#170F12',
  panel: '#1F151A',
  panel2: '#271A20',
  line: '#38252C',
  fg: '#F5E8EB',
  muted: '#B39AA1',
  accent: '#EF5B83',
  onAccent: '#25080F',
  out: '#6B2A3D',
  outInk: '#FDE9EE',
  incoming: '#2A1D23',
  tick: '#5CB4F0',
  statusBar: 'light-content',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
