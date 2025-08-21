export interface ParseResult {
  chave: string;
  resumo: { emit: any; dest: any; ide: any; total: any };
  itens: any[];
}

export function parseNfe(xml: string): ParseResult {
  const match = xml.match(/<infNFe[^>]*Id="NFe(\d{44})"/);
  const chave = match ? match[1] : ''.padStart(44, '0');
  return { chave, resumo: { emit: {}, dest: {}, ide: {}, total: {} }, itens: [] };
}
