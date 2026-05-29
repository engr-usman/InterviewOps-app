declare module "pdf2json" {
  export default class PDFParser {
    on(event: string, callback: (...args: unknown[]) => void): void;
    parseBuffer(buffer: unknown): void;
  }
}
