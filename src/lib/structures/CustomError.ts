export class CustomError extends Error {
	private code: number;
	public constructor(code: number, message: string) {
		super(message);
		this.code = code;
		this.message = message;
	}
	public getCode() {
		return this.code;
	}
	public toJSON() {
		return {
			message: this.message,
		};
	}
}
