// Erro de regra de negócio com código HTTP associado.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
