declare module 'ink-box' {
  const Box: any;
  export default Box;
}

declare module 'pdf-parse' {
  const pdf: (dataBuffer: Buffer, options?: any) => Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
  export = pdf;
}
