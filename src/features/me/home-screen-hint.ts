export type HomeScreenEnv = {
  web: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
};

/** One settings line. Hidden once the site is already opened from the home screen. */
export function homeScreenInstallHint(env: HomeScreenEnv): string | null {
  if (!env.web || env.standalone) return null;
  const ios = /iPad|iPhone|iPod/i.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
  if (ios) return '在 Safari 点分享 → 添加到主屏幕';
  return '在浏览器菜单里选择「添加到主屏幕」';
}
