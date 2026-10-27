declare module 'child_process' {
  export function spawnSync(
    command: string,
    args: readonly string[],
    options: { cwd: string; encoding: 'utf8' },
  ): { status: number | null; stdout: string };
}

declare module 'fs' {
  export function readFileSync(file: string, encoding: 'utf8'): string;
  export function writeFileSync(file: string, data: string): void;
  export function unlinkSync(file: string): void;
}

declare module 'path' {
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
  export function extname(file: string): string;
}
