"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { AvatarUpload } from "@/components/auth/AvatarUpload";
import {
  Settings,
  User,
  Palette,
  Brain,
  Link2,
  Bell,
  Shield,
  Download,
  Upload,
  Key,
  Check,
  Sun,
  Moon,
  Sparkles,
  Info,
  ShieldCheck,
  Calendar,
  Clock as ClockIcon,
} from "lucide-react";

const themePreviews = [
  { id: "light", name: "Light", icon: Sun, description: "Clean and professional" },
  { id: "dark", name: "Dark", icon: Moon, description: "Easy on the eyes" },
  { id: "hybrid", name: "Hybrid", icon: Sparkles, description: "Futuristic glassmorphism" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
  });

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        displayName: user.displayName || "",
      });
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // Update Firebase Auth Profile (Only displayName now, photoURL is handled by AvatarUpload)
      await updateProfile(user, {
        displayName: formData.displayName,
      });

      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        name: formData.displayName,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      console.error("Error updating profile:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const defaultName = user?.email?.split("@")[0] || "User";

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8 max-w-4xl"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your account and application preferences
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="context" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Context</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="workspace" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Workspace</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <AvatarUpload />

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input 
                      placeholder={defaultName} 
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input value={user?.email || ""} type="email" disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Input value="Member" disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Firebase UID</label>
                    <Input value={user?.uid || ""} disabled className="font-mono text-xs" />
                  </div>
                </div>

                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    message.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => user && setFormData({
                    displayName: user.displayName || "",
                  })}>Cancel</Button>
                  <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Account Information
                </CardTitle>
                <CardDescription>View your account security and metadata</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Provider</span>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {user?.providerData[0]?.providerId.split('.')[0] || "Email"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Created</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Last Login</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">UID</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                      {user?.uid}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {themePreviews.map((t) => {
                    const Icon = t.icon;
                    const isActive = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as "light" | "dark" | "hybrid")}
                        className={`relative flex flex-col items-center p-6 rounded-xl border-2 transition-all ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <div className={`h-12 w-12 rounded-lg ${
                          t.id === "light" ? "bg-white border shadow-sm" :
                          t.id === "dark" ? "bg-slate-900" :
                          "bg-gradient-to-br bg-gradient-hybrid"
                        } flex items-center justify-center mb-3`}>
                          <Icon className={`h-6 w-6 ${
                            t.id === "light" ? "text-slate-900" :
                            t.id === "dark" ? "text-white" :
                            "text-violet-300"
                          }`} />
                        </div>
                        <h3 className="font-medium">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Provider Configuration</CardTitle>
                <CardDescription>Configure API keys for AI features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Gemini API Key", placeholder: "AIza..." },
                  { name: "OpenRouter API Key", placeholder: "sk-or-..." },
                  { name: "OpenAI API Key", placeholder: "sk-..." },
                  { name: "Claude API Key", placeholder: "sk-ant-..." },
                ].map((provider) => (
                  <div key={provider.name} className="space-y-2">
                    <label className="text-sm font-medium">{provider.name}</label>
                    <div className="flex gap-2">
                      <Input type="password" placeholder={provider.placeholder} />
                      <Button variant="outline" size="icon">
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" className="rounded border-input" defaultChecked />
                  <span className="text-sm">Enable AI fallback when primary provider fails</span>
                </div>
                <Button className="w-full">Save API Keys</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="context" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Context</CardTitle>
                <CardDescription>Import or export your shared project memory</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-auto py-6 flex flex-col gap-2">
                    <Upload className="h-6 w-6" />
                    <span>Import Context</span>
                    <span className="text-xs text-muted-foreground">Load from JSON file</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-6 flex flex-col gap-2">
                    <Download className="h-6 w-6" />
                    <span>Export Context</span>
                    <span className="text-xs text-muted-foreground">Save as JSON file</span>
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm">
                    <strong>Current Context:</strong> E-commerce Platform project with 12 phases, 34 tasks, and 5 team members.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect external services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Firebase", status: "connected", icon: Shield },
                  { name: "GitHub", status: "connected", icon: Shield },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <integration.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{integration.name}</p>
                        <Badge variant="success" className="mt-1">{integration.status}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Disconnect</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Email notifications", defaultChecked: true },
                  { label: "Push notifications", defaultChecked: true },
                  { label: "Task assignments", defaultChecked: true },
                  { label: "Commit summaries", defaultChecked: false },
                  { label: "Sprint updates", defaultChecked: true },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                    <span className="text-sm">{pref.label}</span>
                    <input type="checkbox" className="rounded border-input" defaultChecked={pref.defaultChecked} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>Configure team and sprint preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Sprint Duration</label>
                    <Input defaultValue="2 weeks" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Working Days</label>
                    <Input defaultValue="Mon - Fri" />
                  </div>
                </div>
                <Button>Save Workspace Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
