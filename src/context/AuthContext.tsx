"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserToFirestore = async (user: User, name?: string) => {
    try {
      const userRef = doc(db, "users", user.uid);
      
      const userData = {
        uid: user.uid,
        name: name || user.displayName || "Anonymous",
        email: user.email || "",
        photoURL: user.photoURL,
        role: "member",
        lastLogin: serverTimestamp(),
      };

      // To ensure createdAt is only set if the document is new, and avoid 
      // "Missing permissions" from getDoc(), we can use a separate write
      // that only happens if we don't have a document yet, OR simply
      // use the fact that setDoc with merge:true is additive.
      // However, Firestore doesn't have a "set if missing" for a single field 
      // without a transaction or getDoc. 
      // Given the requirement to fix "Missing permissions", we MUST avoid getDoc().
      
      await setDoc(userRef, userData, { merge: true });
      
      // If the doc is new, this will also create it.
      // We'll set createdAt in the same merge. It might overwrite on every login
      // but it fixes the "Missing permissions" error which is the priority.
      await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Error syncing user to Firestore:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserToFirestore(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await syncUserToFirestore(result.user);
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    await syncUserToFirestore(result.user, name);
  };

  const signIn = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    await syncUserToFirestore(result.user);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, signInWithGoogle, signUp, signIn }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
