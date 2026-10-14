/** Seleciona metadados de erro permitidos para logs sem copiar a mensagem ou a conexão. */
/**
 * Retorna apenas nome e código que passam pelas expressões permitidas.
 * @param {unknown} error - Falha recebida pelo tratamento de erros.
 * @returns {{tipo: string, codigo: string|undefined}} Metadados para log.
 */
export function erroSanitizado(error){return {
 tipo:/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error?.name||'')?error.name:'Error',
 codigo:/^[A-Z0-9_]{1,24}$/.test(error?.code||'')?error.code:undefined
};}
