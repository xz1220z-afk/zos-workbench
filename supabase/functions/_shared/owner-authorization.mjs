export class OwnerAuthorizationError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'OwnerAuthorizationError';
    this.code = code;
    this.status = status;
  }
}

export function requireConfiguredOwner(identity, { ownerId } = {}) {
  if (!ownerId) throw new OwnerAuthorizationError('service_not_configured', 503);
  if (!identity?.user?.id || identity.user.id !== ownerId) {
    throw new OwnerAuthorizationError('authorization_forbidden', 403);
  }
  return identity;
}
