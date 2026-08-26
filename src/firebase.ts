import { initializeApp, getApps, getApp, setLogLevel } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfigFile from "../firebase-applet-config.json";

// Suppress internal Firebase SDK log noise
try {
  setLogLevel("silent");
} catch {
  // Ignore if unsupported in environment
}

const firebaseConfig = {
  apiKey: firebaseConfigFile.apiKey,
  authDomain: firebaseConfigFile.authDomain,
  projectId: firebaseConfigFile.projectId,
  storageBucket: firebaseConfigFile.storageBucket,
  messagingSenderId: firebaseConfigFile.messagingSenderId,
  appId: firebaseConfigFile.appId,
};

const databaseId = firebaseConfigFile.firestoreDatabaseId || "ai-studio-tequilalaposmana-4163c539-d59d-4e27-9509-9552ddddc70f";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom database ID
export const db = getFirestore(app, databaseId);

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
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Error (operating in offline/local storage mode):', JSON.stringify(errInfo));
}

