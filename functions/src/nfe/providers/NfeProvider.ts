export interface NfeProvider {
  downloadXml(chave: string): Promise<string>;
}
