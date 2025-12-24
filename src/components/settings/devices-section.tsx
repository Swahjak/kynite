"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import {
  Tablet,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Device {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  lastActiveAt: string;
}

interface DevicesSectionProps {
  locale: string;
}

export function DevicesSection({ locale }: DevicesSectionProps) {
  const t = useTranslations("DevicesPage");
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const dateLocale = locale === "nl" ? nl : enUS;

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/v1/devices");
      const data = await response.json();
      if (data.success) {
        setDevices(data.data.devices);
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleGenerateCode = async () => {
    if (!newDeviceName.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/v1/devices/pair/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: newDeviceName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setPairingCode(data.data.code);
      } else {
        toast.error("Failed to generate code");
      }
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRename = async () => {
    if (!selectedDevice || !newDeviceName.trim()) return;

    try {
      const response = await fetch(`/api/v1/devices/${selectedDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeviceName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Device renamed");
        fetchDevices();
      } else {
        toast.error("Failed to rename device");
      }
    } catch {
      toast.error("Failed to rename device");
    } finally {
      setShowRenameDialog(false);
      setSelectedDevice(null);
      setNewDeviceName("");
    }
  };

  const handleRemove = async () => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`/api/v1/devices/${selectedDevice.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Device removed");
        fetchDevices();
      } else {
        toast.error("Failed to remove device");
      }
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setShowRemoveDialog(false);
      setSelectedDevice(null);
    }
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setNewDeviceName("");
    setPairingCode(null);
    fetchDevices(); // Refresh in case device was paired
  };

  const isActive = (lastActiveAt: string) => {
    const lastActive = new Date(lastActiveAt);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastActive > hourAgo;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="mr-2 size-4" />
            {t("addDevice")}
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="py-8 text-center">
              <Tablet className="text-muted-foreground mx-auto mb-4 size-12" />
              <p className="font-medium">{t("noDevices")}</p>
              <p className="text-muted-foreground text-sm">
                {t("noDevicesDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                      <Tablet className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">{device.displayName}</p>
                      <p className="text-muted-foreground text-sm">
                        {t("pairedOn")}{" "}
                        {new Date(device.createdAt).toLocaleDateString(locale)}{" "}
                        • {t("lastActive")}{" "}
                        {formatDistanceToNow(new Date(device.lastActiveAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        isActive(device.lastActiveAt)
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          isActive(device.lastActiveAt)
                            ? "bg-green-600"
                            : "bg-muted-foreground"
                        }`}
                      />
                      {isActive(device.lastActiveAt)
                        ? t("active")
                        : t("inactive")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDevice(device);
                            setNewDeviceName(device.displayName);
                            setShowRenameDialog(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          {t("rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowRemoveDialog(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t("remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={closeAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addDeviceDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("addDeviceDialog.description")}
            </DialogDescription>
          </DialogHeader>

          {!pairingCode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("addDeviceDialog.deviceName")}</Label>
                <Input
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder={t("addDeviceDialog.deviceNamePlaceholder")}
                />
              </div>
              <Button
                onClick={handleGenerateCode}
                disabled={!newDeviceName.trim() || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t("addDeviceDialog.generate")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div>
                <Label>{t("addDeviceDialog.code")}</Label>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="font-mono text-4xl tracking-widest">
                    {pairingCode}
                  </span>
                  <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                    {codeCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                {t("addDeviceDialog.codeExpires", { minutes: 5 })}
              </p>
              <Button onClick={closeAddDialog} className="w-full">
                {t("addDeviceDialog.done")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("renameDialog.newName")}</Label>
              <Input
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={!newDeviceName.trim()}>
              {t("renameDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirmDescription", {
                deviceName: selectedDevice?.displayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
