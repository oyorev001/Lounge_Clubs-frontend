import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileText, Locate, MapPin, Upload } from "lucide-react";
import { Map, Marker } from "pigeon-maps";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_MAP_CENTER,
  isPlausibleNin,
  LGA_COORDINATES,
  OYO_LGAS,
  readPendingVenueTypes,
  VENUE_TYPES,
} from "@/lib/oyo";
import { cn } from "@/lib/utils";
import { establishmentsApi, queryKeys } from "@/services";
import type { EstablishmentType, RegisterEstablishmentPayload } from "@/services";

export const Route = createFileRoute("/dashboard/establishments/register")({
  component: RegisterEstablishmentPage,
});

type AmenityKey =
  | "hasLiveBand"
  | "hasDj"
  | "hasVipArea"
  | "hasPoolTable"
  | "hasShisha"
  | "hasRooftop"
  | "hasRestaurant"
  | "hasOutdoorSpace"
  | "hasLodging"
  | "hasParking";

interface AmenityDef {
  key: AmenityKey;
  label: string;
  hint: string;
  types: readonly EstablishmentType[];
}

const ALL_TYPES = ["Bar", "Lounge", "Club", "Nightclub"] as const;

const AMENITIES: AmenityDef[] = [
  {
    key: "hasDj",
    label: "DJ booth",
    hint: "Resident or guest DJ setup",
    types: ["Club", "Nightclub"],
  },
  {
    key: "hasVipArea",
    label: "VIP area / bottle service",
    hint: "Private booths or sections",
    types: ["Club", "Nightclub"],
  },
  { key: "hasLiveBand", label: "Live band", hint: "Regular live music", types: ALL_TYPES },
  { key: "hasPoolTable", label: "Pool table", hint: "Snooker or pool table", types: ["Bar"] },
  { key: "hasShisha", label: "Shisha", hint: "Hookah service", types: ["Lounge", "Club"] },
  {
    key: "hasRooftop",
    label: "Rooftop / terrace",
    hint: "Open-air upper level",
    types: ["Lounge", "Nightclub"],
  },
  {
    key: "hasRestaurant",
    label: "Restaurant / kitchen",
    hint: "Serves full meals",
    types: ["Lounge", "Bar"],
  },
  {
    key: "hasOutdoorSpace",
    label: "Outdoor space",
    hint: "Garden or patio seating",
    types: ALL_TYPES,
  },
  { key: "hasLodging", label: "Lodging", hint: "Rooms for overnight guests", types: ALL_TYPES },
  { key: "hasParking", label: "Parking", hint: "Dedicated parking bays", types: ALL_TYPES },
];

/** Amenities shown per selected type — a Club+Bar gets DJ/VIP *and* pool table options. */
function amenitiesForType(type: EstablishmentType): AmenityDef[] {
  return AMENITIES.filter((a) => a.types.includes(type));
}

const SHARED_AMENITIES: AmenityDef[] = AMENITIES.filter((a) => a.types.length === ALL_TYPES.length);

const STEPS = ["Venue type", "Identity & CAC", "Venue details", "Operations", "Review"];

const initialForm = {
  types: [] as EstablishmentType[],
  nin: "",
  cacNumber: "",
  name: "",
  description: "",
  address: "",
  lga: "",
  landmark: "",
  latitude: null as number | null,
  longitude: null as number | null,
  contactPhone: "",
  contactEmail: "",
  capacity: "",
  staffCount: "",
  floorAreaSqm: "",
  parkingSpaces: "",
  operatingHours: "",
  hasLiveBand: false,
  hasDj: false,
  hasVipArea: false,
  hasPoolTable: false,
  hasShisha: false,
  hasRooftop: false,
  hasRestaurant: false,
  hasOutdoorSpace: false,
  hasLodging: false,
  hasParking: false,
};

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function RegisterEstablishmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    ...initialForm,
    // If the owner picked venue types during public signup, carry them in.
    types: readPendingVenueTypes(),
  }));
  const [cacFile, setCacFile] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);

  const pinCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error(
        "Geolocation is not supported by this browser — pin the venue on the map instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        toast.success("Location captured — confirm the pin on the map.");
      },
      () => {
        setLocating(false);
        toast.error("Location access denied — pin the venue on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const set =
    (k: keyof typeof initialForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleType = (type: EstablishmentType) =>
    setForm((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type],
    }));

  const uploadCac = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      establishmentsApi.uploadDocument(id, file, "CacCertificate"),
  });

  const register = useMutation({
    mutationFn: (body: RegisterEstablishmentPayload) => establishmentsApi.register(body),
    onSuccess: async (res) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.establishments.mine() });
      if (cacFile) {
        try {
          await uploadCac.mutateAsync({ id: res.id, file: cacFile });
        } catch {
          toast.warning(
            "Registered, but the CAC certificate upload failed — please upload it from the establishment page.",
          );
        }
      }
      toast.success("Establishment registered — an officer will review and assign your tier");
      void navigate({ to: "/dashboard/establishments/$id", params: { id: res.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Registration failed"),
  });

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 0:
        if (!form.types.length) {
          toast.error("Select at least one venue type — pick every operation your venue runs.");
          return false;
        }
        return true;
      case 1:
        if (!isPlausibleNin(form.nin)) {
          toast.error("Enter a real 11-digit NIN — placeholders or repeated digits won't pass.");
          return false;
        }
        if (!form.cacNumber.trim()) {
          toast.error("Enter your CAC registration number (e.g. RC1234567).");
          return false;
        }
        if (!cacFile) {
          toast.error("Upload your CAC certificate document to continue.");
          return false;
        }
        return true;
      case 2:
        if (!form.name.trim() || !form.address.trim() || !form.lga || !form.contactPhone.trim()) {
          toast.error("Fill in the venue name, address, LGA and contact phone.");
          return false;
        }
        if (form.latitude == null || form.longitude == null) {
          toast.error("Pin the venue's exact location — use your location or tap the map.");
          return false;
        }
        return true;
      case 3: {
        const capacity = Number(form.capacity);
        const staffCount = Number(form.staffCount);
        if (!Number.isFinite(capacity) || capacity <= 0) {
          toast.error("Enter a valid guest capacity.");
          return false;
        }
        if (!Number.isFinite(staffCount) || staffCount < 0) {
          toast.error("Enter a valid staff count.");
          return false;
        }
        if (form.hasParking && (!form.parkingSpaces || Number(form.parkingSpaces) <= 0)) {
          toast.error("Enter how many parking spaces the venue has.");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    const payload: RegisterEstablishmentPayload = {
      name: form.name.trim(),
      types: form.types,
      address: form.address.trim(),
      lga: form.lga,
      contactPhone: form.contactPhone.trim(),
      cacNumber: form.cacNumber.trim(),
      // Step-2 validation guarantees both coordinates are set before submit.
      latitude: form.latitude!,
      longitude: form.longitude!,
      nin: form.nin,
      capacity: Number(form.capacity),
      staffCount: Number(form.staffCount),
      // Only send amenities valid for the selected venue types — flags set
      // before a type was deselected must not leak into the payload.
      ...(Object.fromEntries(
        AMENITIES.map((a) => [
          a.key,
          a.types.some((t) => form.types.includes(t)) ? form[a.key] : false,
        ]),
      ) as Pick<RegisterEstablishmentPayload, AmenityDef["key"]>),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.landmark.trim() ? { landmark: form.landmark.trim() } : {}),
      ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
      ...(form.floorAreaSqm ? { floorAreaSqm: Number(form.floorAreaSqm) } : {}),
      ...(form.hasParking && form.parkingSpaces
        ? { parkingSpaces: Number(form.parkingSpaces) }
        : {}),
      ...(form.operatingHours.trim() ? { operatingHours: form.operatingHours.trim() } : {}),
    };
    register.mutate(payload);
  };

  const visibleAmenityKeys = new Set<AmenityKey>(
    form.types.flatMap((t) => amenitiesForType(t).map((a) => a.key)),
  );
  const amenityLabels = AMENITIES.filter((a) => visibleAmenityKeys.has(a.key) && form[a.key]).map(
    (a) => a.label,
  );

  return (
    <div className="px-4 py-6 sm:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard/establishments">
          <ArrowLeft className="size-4" /> Back to establishments
        </Link>
      </Button>

      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Register your establishment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what you operate, verify your identity, and submit for officer review.
          </p>
        </div>

        {/* Stepper */}
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    i < step && "border-primary bg-primary text-primary-foreground",
                    i === step && "border-primary text-primary",
                    i > step && "border-border text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    i === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span
                  className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")}
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <SectionCard
            title="What does your establishment operate?"
            description="Select every type that applies — your levy is assessed on the highest category."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {VENUE_TYPES.map((v) => {
                const selected = form.types.includes(v.type);
                return (
                  <button
                    key={v.type}
                    type="button"
                    onClick={() => toggleType(v.type)}
                    className={cn(
                      "group overflow-hidden rounded-xl border text-left transition-all",
                      selected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative h-24 overflow-hidden">
                      <img
                        src={v.image}
                        alt={v.type}
                        className="size-full object-cover object-top transition-transform group-hover:scale-105"
                      />
                      {selected ? (
                        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <div className="px-3 py-2">
                      <p className="font-semibold">{v.type}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        {step === 1 ? (
          <SectionCard
            title="Owner identity & business registration"
            description="Officers use these to verify the application — all fields are required."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nin">National Identification Number (NIN)</Label>
                <Input
                  id="nin"
                  required
                  inputMode="numeric"
                  maxLength={11}
                  value={form.nin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nin: e.target.value.replace(/\D/g, "") }))
                  }
                  placeholder="11-digit NIN"
                />
                <p className="text-xs text-muted-foreground">
                  Must be exactly 11 digits — find it on your NIN slip or *346#.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cacNumber">CAC registration number</Label>
                <Input
                  id="cacNumber"
                  required
                  value={form.cacNumber}
                  onChange={set("cacNumber")}
                  placeholder="e.g. RC1234567 or BN1234567"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cacFile">CAC certificate document</Label>
                <label
                  htmlFor="cacFile"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:border-primary/50"
                >
                  {cacFile ? (
                    <>
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{cacFile.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {(cacFile.size / 1024).toFixed(0)} KB — tap to change
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Upload your CAC certificate — PDF, JPG or PNG
                      </span>
                    </>
                  )}
                </label>
                <input
                  id="cacFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(e) => setCacFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </SectionCard>
        ) : null}

        {step === 2 ? (
          <SectionCard title="Venue details" description="Where the venue is and how to reach it">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Establishment name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={set("name")}
                  placeholder="e.g. De Roca Lounge"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  required
                  value={form.contactPhone}
                  onChange={set("contactPhone")}
                  placeholder="0803 000 0000"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  required
                  value={form.address}
                  onChange={set("address")}
                  placeholder="Street address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lga">Local government area</Label>
                <Select value={form.lga} onValueChange={(v) => setForm((f) => ({ ...f, lga: v }))}>
                  <SelectTrigger id="lga">
                    <SelectValue placeholder="Select LGA" />
                  </SelectTrigger>
                  <SelectContent>
                    {OYO_LGAS.map((lga) => (
                      <SelectItem key={lga} value={lga}>
                        {lga}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="landmark">
                  Landmark <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="landmark"
                  value={form.landmark}
                  onChange={set("landmark")}
                  placeholder="Nearest landmark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">
                  Email <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={set("contactEmail")}
                  placeholder="venue@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatingHours">
                  Operating hours <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="operatingHours"
                  value={form.operatingHours}
                  onChange={set("operatingHours")}
                  placeholder="e.g. Mon–Sun, 6pm – 2am"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={set("description")}
                  placeholder="Brief description of the venue"
                />
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Exact venue location</p>
                  <p className="text-xs text-muted-foreground">
                    Stand at the venue and use your location, or tap the map to drop the pin.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locating}
                  onClick={pinCurrentLocation}
                >
                  <Locate className="size-4" />
                  {locating ? "Locating…" : "Use my current location"}
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <Map
                  key={form.lga}
                  height={260}
                  defaultCenter={
                    form.latitude != null && form.longitude != null
                      ? [form.latitude, form.longitude]
                      : (LGA_COORDINATES[form.lga] ?? DEFAULT_MAP_CENTER)
                  }
                  defaultZoom={14}
                  onClick={({ latLng }) =>
                    setForm((f) => ({ ...f, latitude: latLng[0], longitude: latLng[1] }))
                  }
                >
                  {form.latitude != null && form.longitude != null ? (
                    <Marker width={40} anchor={[form.latitude, form.longitude]} color="#700002" />
                  ) : null}
                </Map>
              </div>

              {form.latitude != null && form.longitude != null ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <MapPin className="size-3.5" />
                  Pinned at {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No location pinned yet — inspectors use this to find the venue.
                </p>
              )}
            </div>
          </SectionCard>
        ) : null}

        {step === 3 ? (
          <SectionCard
            title="Capacity & amenities"
            description="Used to suggest a license tier — the officer assigns the final tier."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="capacity">Guest capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  required
                  value={form.capacity}
                  onChange={set("capacity")}
                  placeholder="Max. guests"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffCount">Staff count</Label>
                <Input
                  id="staffCount"
                  type="number"
                  min={0}
                  required
                  value={form.staffCount}
                  onChange={set("staffCount")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floorAreaSqm">
                  Floor area (m²) <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="floorAreaSqm"
                  type="number"
                  min={0}
                  value={form.floorAreaSqm}
                  onChange={set("floorAreaSqm")}
                />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium">Amenities — tick all that apply</p>
              {form.types.map((t) => {
                const specific = amenitiesForType(t).filter(
                  (a) => !SHARED_AMENITIES.some((s) => s.key === a.key),
                );
                if (!specific.length) return null;
                return (
                  <div key={t}>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
                      {t} amenities
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {specific.map((a) => (
                        <label
                          key={a.key}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={form[a.key]}
                            onCheckedChange={(v) => setForm((f) => ({ ...f, [a.key]: v === true }))}
                          />
                          <span>
                            <span className="block font-medium">{a.label}</span>
                            <span className="text-xs text-muted-foreground">{a.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Shared facilities
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {SHARED_AMENITIES.map((a) => (
                    <label
                      key={a.key}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={form[a.key]}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, [a.key]: v === true }))}
                      />
                      <span>
                        <span className="block font-medium">{a.label}</span>
                        <span className="text-xs text-muted-foreground">{a.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {form.hasParking ? (
              <div className="mt-4 max-w-xs space-y-2">
                <Label htmlFor="parkingSpaces">Parking spaces</Label>
                <Input
                  id="parkingSpaces"
                  type="number"
                  min={0}
                  value={form.parkingSpaces}
                  onChange={set("parkingSpaces")}
                  placeholder="e.g. 20"
                />
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {step === 4 ? (
          <SectionCard
            title="Review your application"
            description="Confirm everything is correct — officers will verify against your documents."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="divide-y divide-border">
                <ReviewRow label="Venue operations" value={form.types.join(" + ")} />
                <ReviewRow label="Establishment name" value={form.name} />
                <ReviewRow label="Address" value={form.address} />
                <ReviewRow label="LGA" value={form.lga} />
                <ReviewRow
                  label="Coordinates"
                  value={
                    form.latitude != null
                      ? `${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`
                      : null
                  }
                />
                <ReviewRow label="Landmark" value={form.landmark} />
                <ReviewRow label="Phone" value={form.contactPhone} />
                <ReviewRow label="Email" value={form.contactEmail} />
              </div>
              <div className="divide-y divide-border">
                <ReviewRow
                  label="NIN"
                  value={form.nin.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3")}
                />
                <ReviewRow label="CAC number" value={form.cacNumber} />
                <ReviewRow label="CAC certificate" value={cacFile?.name} />
                <ReviewRow label="Capacity" value={form.capacity} />
                <ReviewRow label="Staff" value={form.staffCount} />
                <ReviewRow label="Operating hours" value={form.operatingHours} />
                <ReviewRow
                  label="Amenities"
                  value={amenityLabels.length ? amenityLabels.join(", ") : "None"}
                />
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              By submitting you confirm the details and documents provided are accurate. False
              declarations may lead to rejection, fines or certificate revocation.
            </p>
          </SectionCard>
        ) : null}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" disabled={register.isPending} onClick={submit}>
              {register.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
