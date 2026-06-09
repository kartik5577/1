import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const errorMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errorMsg.toLowerCase().includes('offline') || errorMsg.toLowerCase().includes('unreachable') || !navigator.onLine;

  if (isOffline) {
    console.warn(`[Firestore Offline Cache & Recovery] Operation: ${operationType.toUpperCase()} on Path: "${path || 'unknown'}". Message: ${errorMsg}. Falling back to default cached data values and waiting to auto-reconnect.`);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  // Do not throw for background reads (GET/LIST) to prevent crashing the entire application layout.
  // The app will continue rendering with default values and local empty structures.
  if (operationType !== OperationType.GET && operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}
