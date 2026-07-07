export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message); // asosiy Error konstruktorini chaqiramiz
    this.code = code;
    this.statusCode = statusCode;
  }
}
