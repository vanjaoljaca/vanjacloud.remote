declare module "bun:test" {
  export interface Test {
    describe: (name: string, fn: () => void) => void;
  }
}
