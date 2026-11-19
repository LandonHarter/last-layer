"use client";

import { useState } from "react";
import { BatteryIcon, BluetoothConnectedIcon, BluetoothIcon, BluetoothSearchingIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Face } from "@/lib/cube";
import { opposite } from "@/lib/smartcube/state";
import {
  answerMac,
  connectCube,
  connectVirtualCube,
  disconnectCube,
  isMac,
  markSolved,
  resyncCube,
  updateCubeSettings,
  useCubeSettings,
  useSmartCube,
  VIRTUAL_CUBE,
} from "@/lib/smartcube/store";
import { cn } from "@/lib/utils";

/** Colour names for the cube's centres (WCA scheme: white up, green front). */
export const COLOUR_NAME: Record<Face, string> = { U: "White", D: "Yellow", F: "Green", B: "Blue", R: "Red", L: "Orange" };
const FACES: Face[] = ["U", "D", "F", "B", "R", "L"];

export function SmartCubeButton() {
  const cube = useSmartCube();
  const [open, setOpen] = useState(false);
  const connected = cube.status === "connected";
  const Icon = connected ? BluetoothConnectedIcon : cube.status === "connecting" ? BluetoothSearchingIcon : BluetoothIcon;
  // Keep the popover open while the cube asks for its MAC address.
  const showing = open || !!cube.macRequest;
  if (cube.status === "unsupported" && !VIRTUAL_CUBE) return null;

  return (
    <Popover open={showing} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={connected ? `Smart cube: ${cube.name}` : "Connect a smart cube"}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          connected && "text-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {connected && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-learned" aria-hidden="true" />}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 gap-3 p-3">
        {cube.macRequest ? (
          <MacForm device={cube.macRequest.device} />
        ) : connected ? (
          <Connected name={cube.name ?? "Smart cube"} battery={cube.battery} virtual={cube.virtual} />
        ) : (
          <>
            <p className="font-semibold">Smart cube</p>
            <p className="text-muted-foreground">
              Connect a GAN smart cube to run the timer by turning (it follows the scramble, starts on your first turn and stops when solved) and to
              answer drills by doing the algorithm.
            </p>
            {cube.status === "unsupported" && <p className="text-muted-foreground">This browser has no Bluetooth. Use Chrome or Edge.</p>}
            {cube.status === "error" && <p className="text-missed">{cube.error}</p>}
            <div className="flex gap-2">
              {cube.status !== "unsupported" && (
                <Button size="sm" className="flex-1" disabled={cube.status === "connecting"} onClick={connectCube}>
                  {cube.status === "connecting" ? "Connecting…" : cube.status === "error" ? "Try again" : "Connect"}
                </Button>
              )}
              {VIRTUAL_CUBE && (
                <Button variant="outline" size="sm" className="flex-1" onClick={connectVirtualCube}>
                  Virtual cube
                </Button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Connected({ name, battery, virtual }: { name: string; battery?: number; virtual?: boolean }) {
  const settings = useCubeSettings();
  const fronts = FACES.filter((f) => f !== settings.gripTop && f !== opposite[settings.gripTop]);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{name}</p>
        {battery !== undefined && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
            <BatteryIcon className="size-4" aria-hidden="true" />
            {battery}%
          </span>
        )}
      </div>
      {virtual && (
        <p className="text-muted-foreground">
          Turn it from the console: <code className="font-mono text-xs">__smartcube.turn(&quot;R U R&apos;&quot;)</code>
        </p>
      )}
      <p className="text-muted-foreground">If the app and the cube disagree, solve it and press Mark solved.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={markSolved}>
          Mark solved
        </Button>
        {!virtual && (
          <Button variant="outline" size="sm" className="flex-1" onClick={resyncCube}>
            Read cube
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-sm font-medium">How you hold it for algorithms</span>
        <div className="grid grid-cols-2 gap-2">
          <ColourSelect
            label="Top"
            value={settings.gripTop}
            options={FACES}
            onChange={(top) => updateCubeSettings({ gripTop: top, ...(settings.gripFront === top || settings.gripFront === opposite[top] ? { gripFront: FACES.find((f) => f !== top && f !== opposite[top]) } : {}) })}
          />
          <ColourSelect label="Front" value={settings.gripFront} options={fronts} onChange={(front) => updateCubeSettings({ gripFront: front })} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Drill and Learn read your turns from this hold, so R is the face on your right.</p>
      </div>
      <Button variant="ghost" size="sm" onClick={disconnectCube}>
        Disconnect
      </Button>
    </>
  );
}

function ColourSelect({ label, value, options, onChange }: { label: string; value: Face; options: Face[]; onChange: (f: Face) => void }) {
  const items = options.map((f) => ({ value: f, label: COLOUR_NAME[f] }));
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as Face)}>
        <SelectTrigger className="h-9 w-full" aria-label={`${label} colour`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function MacForm({ device }: { device: string }) {
  const [value, setValue] = useState("");
  const valid = isMac(value);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) answerMac(value);
      }}
    >
      <p className="font-semibold">MAC address of {device}</p>
      <p className="text-muted-foreground">
        GAN cubes need their MAC address to connect. Find it in the GAN app under the cube&apos;s info, or in Chrome at chrome://bluetooth-internals. It&apos;s
        remembered in this browser. (Turning on chrome://flags#enable-experimental-web-platform-features lets Chrome read it itself.)
      </p>
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="AB:12:CD:34:EF:56"
        aria-label="MAC address"
        aria-invalid={value !== "" && !valid}
        className="font-mono"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => answerMac(null)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid}>
          Connect
        </Button>
      </div>
    </form>
  );
}
