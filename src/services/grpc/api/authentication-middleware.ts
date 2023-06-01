import { Status, ServerMiddlewareCall, CallContext, ServerError } from 'nice-grpc';
import { getPNIDByBearerAuth } from '@/database';
import type { HydratedPNIDDocument } from '@/types/mongoose/pnid';

// * These paths require that a token be present
const TOKEN_REQUIRED_PATHS: string[] = [
	'/api.API/GetUserData',
	'/api.API/UpdateUserData',
	'/api.API/ResetPassword', // * This paths token is not an authentication token, it is a password reset token
	'/api.API/SetDiscordConnectionData',
	'/api.API/SetStripeConnectionData',
	'/api.API/RemoveConnection'
];

export type AuthenticationCallContextExt = {
	pnid: HydratedPNIDDocument | null;
};

export async function* authenticationMiddleware<Request, Response>(
	call: ServerMiddlewareCall<Request, Response, AuthenticationCallContextExt>,
	context: CallContext,
): AsyncGenerator<Response, Response | void, undefined> {
	const token: string | undefined = context.metadata.get('X-Token')?.trim();

	if (!token && TOKEN_REQUIRED_PATHS.includes(call.method.path)) {
		throw new ServerError(Status.UNAUTHENTICATED, 'Missing or invalid authentication token');
	}

	try {
		let pnid: HydratedPNIDDocument | null = null;

		if (token) {
			pnid = await getPNIDByBearerAuth(token);
		}

		if (!pnid && TOKEN_REQUIRED_PATHS.includes(call.method.path)) {
			throw new ServerError(Status.UNAUTHENTICATED, 'Missing or invalid authentication token');
		}

		return yield* call.next(call.request, {
			...context,
			pnid
		});
	} catch (error) {
		let message: string = 'Unknown server error';

		console.log(error);

		if (error instanceof Error) {
			message = error.message;
		}

		throw new ServerError(Status.INVALID_ARGUMENT, message);
	}
}