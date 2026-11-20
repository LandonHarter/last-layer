"use client";

import { useState } from "react";
import { BatteryIcon, BluetoothConnectedIcon, BluetoothIcon, BluetoothSearchingIcon } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Face } from "@/lib/cube";
import { readPairCode } from "@/lib/smartcube/relay";
import { opposite } from "@/lib/smartcube/state";
import {
  answerMac,
  connectCube,
  connectRemoteCube,
  connectVirtualCube,
  disconnectCube,
  isMac,
  markSolved,
  resyncCube,
  shareCube,
  stopSharing,
  updateCubeSettings,
  useCubeSettings,
  useSmartCube,
  VIRTUAL_CUBE,
  webBluetooth,
  type CubeSnapshot,
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
          <Connected cube={cube} />
        ) : cube.remote ? (
          <RemoteWaiting code={cube.remote.code} />
        ) : (
          <NotConnected cube={cube} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotConnected({ cube }: { cube: CubeSnapshot }) {
  const bluetooth = webBluetooth();
  return (
    <>
      <p className="font-semibold">Smart cube</p>
      <p className="text-muted-foreground">
        Connect a GAN smart cube to run the timer by turning (it follows the scramble, starts on your first turn and stops when solved) and to
        answer drills by doing the algorithm.
      </p>
      {!bluetooth && <BluetoothOff />}
      {cube.status === "error" && <p className="text-missed">{cube.error}</p>}
      <div className="flex gap-2">
        {bluetooth && (
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
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-sm font-medium">Cube on another device</span>
        <p className="text-sm text-muted-foreground">
          Bluetooth not working here? Connect the cube on your phone and it sends every turn to this page, for the timer, splits and drills.
        </p>
        <Button variant="outline" size="sm" disabled={cube.status === "connecting"} onClick={connectRemoteCube}>
          Use from another device
        </Button>
      </div>
    </>
  );
}

/** Waiting for the device that has the cube to start sharing. */
function RemoteWaiting({ code }: { code: string }) {
  const user = useAccount();
  return (
    <>
      <p className="font-semibold">Waiting for the other device</p>
      <p className="text-muted-foreground">
        On the device with the cube (on iPhone, the Bluefy browser), open Last Layer, connect the cube, then open this menu and enter this code under
        Share with another device{user ? ", or press Share to my account if it's signed in to the same account" : ""}.
      </p>
      <p className="py-1 text-center font-mono text-3xl font-bold tracking-[0.3em] select-all" aria-label={`Pairing code ${code.split("").join(" ")}`}>
        {code}
      </p>
      <Button variant="ghost" size="sm" onClick={disconnectCube}>
        Cancel
      </Button>
    </>
  );
}

function Connected({ cube }: { cube: CubeSnapshot }) {
  const { battery, virtual, remote } = cube;
  const name = cube.name ?? "Smart cube";
  const settings = useCubeSettings();
  const fronts = FACES.filter((f) => f !== settings.gripTop && f !== opposite[settings.gripTop]);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <p className="font-semibold">{name}</p>
          {remote && <span className="text-xs text-muted-foreground">On another device</span>}
        </div>
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
      {!remote && <ShareSection sharing={cube.sharing} />}
      <Button variant="ghost" size="sm" onClick={disconnectCube}>
        Disconnect
      </Button>
    </>
  );
}

/** Send this cube's turns to another device (one whose Bluetooth can't reach it). */
function ShareSection({ sharing }: { sharing: CubeSnapshot["sharing"] }) {
  const user = useAccount();
  const [typed, setTyped] = useState("");
  const code = readPairCode(typed);
  const box = "flex flex-col gap-2 border-t border-border pt-3";
  if (sharing) {
    const n = sharing.screens;
    return (
      <div className={box}>
        <span className="text-sm font-medium">{sharing.code ? `Sharing with code ${sharing.code}` : "Sharing to your account"}</span>
        {sharing.error ? (
          <p className="text-sm text-missed">{sharing.error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {n ? `Sending turns to ${n} ${n === 1 ? "device" : "devices"}.` : "Connecting to the other device…"} Keep this page open.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={stopSharing}>
          Stop sharing
        </Button>
      </div>
    );
  }
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        if (code) void shareCube(code);
      }}
    >
      <span className="text-sm font-medium">Share with another device</span>
      <p className="text-xs leading-relaxed text-muted-foreground">
        To use this cube on a computer, press Use from another device in its smart cube menu and type the code it shows
        {user ? ", or share to your account if the computer is signed in to it too" : ""}.
      </p>
      <div className="flex gap-2">
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Code"
          aria-label="Pairing code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
        />
        <Button type="submit" size="sm" disabled={!code}>
          Share
        </Button>
      </div>
      {user && (
        <Button type="button" variant="outline" size="sm" onClick={() => void shareCube()}>
          Share to my account
        </Button>
      )}
    </form>
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

/** Why the browser offers no Web Bluetooth, and how to turn it on. */
function BluetoothOff() {
  const brave = typeof navigator !== "undefined" && "brave" in navigator;
  const linux = typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
  const flags = brave ? "brave://flags" : "chrome://flags";
  const code = (text: string) => <code className="font-mono text-xs break-all">{text}</code>;
  if (!brave && !linux) {
    return <p className="text-muted-foreground">This browser can&apos;t use Bluetooth. Use Chrome, Edge or Brave on a computer or Android (on iPhone, the Bluefy browser).</p>;
  }
  return (
    <div className="flex flex-col gap-2 text-muted-foreground">
      <p>This browser has Web Bluetooth (websites using Bluetooth) turned off. Your computer&apos;s Bluetooth is fine. To turn it on:</p>
      <ol className="list-decimal space-y-1 pl-5">
        {brave && <li>Enable {code("brave://flags/#brave-web-bluetooth-api")}</li>}
        {linux && <li>Enable {code(`${flags}/#enable-experimental-web-platform-features`)} (needed on Linux)</li>}
        <li>Relaunch the browser.</li>
      </ol>
    </div>
  );
}
