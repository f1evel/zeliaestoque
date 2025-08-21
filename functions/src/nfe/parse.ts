export interface ParseResult {
  chave: string;
  resumo: Record<string, unknown>;
  itens: any[];
}

export function parseNfe(xml: string): ParseResult {
  const match = xml.match(/<infNFe[^>]*Id="NFe(\d{44})"/);
  const chave = match ? match[1] : ''.padStart(44, '0');
  return { chave, resumo: {}, itens: [] };
}
