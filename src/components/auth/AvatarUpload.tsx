"use client";

import React, { useRef, useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Camera, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function AvatarUpload() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validation
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please select a valid image (JPG, PNG, or WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB.");
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);

    const storageRef = ref(storage, `avatars/${user.uid}/profile-image`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progressPercent);
      },
      (err) => {
        console.error("Upload error:", err);
        setError("Failed to upload image. Please try again.");
        setIsUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Update Firebase Auth
          await updateProfile(user, { photoURL: downloadURL });

          // Update Firestore
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            photoURL: downloadURL,
            updatedAt: serverTimestamp(),
          }, { merge: true });

          setIsUploading(false);
          setProgress(0);
        } catch (err) {
          console.error("Error updating profile:", err);
          setError("Failed to update profile with new image.");
          setIsUploading(false);
        }
      }
    );
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-primary/20 transition-all group-hover:border-primary/50">
            <AvatarImage src={user?.photoURL || ""} className="object-cover" />
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full backdrop-blur-[2px]">
              <LoadingSpinner className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center md:items-start gap-3">
          <div className="flex flex-wrap justify-center md:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="h-4 w-4" />
              {user?.photoURL ? "Change Avatar" : "Upload Avatar"}
            </Button>
            {user?.photoURL && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (!user) return;
                  try {
                    await updateProfile(user, { photoURL: "" });
                    const userRef = doc(db, "users", user.uid);
                    await setDoc(userRef, { photoURL: null, updatedAt: serverTimestamp() }, { merge: true });
                  } catch {
                    setError("Failed to remove avatar.");
                  }
                }}
                disabled={isUploading}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG or WEBP. Max 2MB.
          </p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      {isUploading && progress > 0 && progress < 100 && (
        <div className="space-y-2 max-w-xs mx-auto md:mx-0">
          <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <span>Uploading...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded-lg max-w-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
