"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ccms/icons";
import { AiBrain01Icon, Attachment01Icon, SentIcon } from "@/components/ccms/icons";
import type { ExtractedFields } from "@/integrations/kamios";
import type { Sample } from "@/ccms/demo/samples";
import { LINES_OF_BUSINESS, NATURES, SOURCE_LABELS, SOURCES, type Source } from "@/ccms/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SourceBadge } from "@/components/ccms/badges";
import { cn } from "@/lib/utils";
import { extractAction, logCaseAction, type SourceInput } from "./actions";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type Key = keyof ExtractedFields;

/** The centralised form's field groups and the extracted fields in each. */
const GROUPS: { title: string; fields: { key: Key; label: string; kind?: "text" | "long" | "bool" | "nature" | "lob" }[] }[] = [
  {
    title: "Case information",
    fields: [
      { key: "subject", label: "Subject" },
      { key: "nature", label: "Case nature", kind: "nature" },
      { key: "subType", label: "Sub-type" },
    ],
  },
  {
    title: "Customer",
    fields: [
      { key: "complainantName", label: "Name" },
      { key: "complainantEmail", label: "Email" },
      { key: "complainantPhone", label: "Phone" },
    ],
  },
  {
    title: "Policy and claim",
    fields: [
      { key: "policyNo", label: "Policy no." },
      { key: "claimNo", label: "Claim no." },
      { key: "lineOfBusiness", label: "Line of business", kind: "lob" },
    ],
  },
  {
    title: "Agent and distribution",
    fields: [
      { key: "agentCode", label: "Agent code" },
      { key: "agentInvolved", label: "Agent involved", kind: "bool" },
    ],
  },
  {
    title: "Regulatory",
    fields: [
      { key: "regulatorHint", label: "Regulator cited" },
      { key: "mentionsFidrec", label: "FIDREC mentioned", kind: "bool" },
    ],
  },
  {
    title: "Customer expectation",
    fields: [{ key: "desiredOutcome", label: "Desired outcome", kind: "long" }],
  },
];

function ConfidenceDot({ value }: { value: number }) {
  const tone = value >= 0.8 ? "bg-success" : value >= 0.6 ? "bg-warning" : "bg-muted-foreground/40";
  return <span className={cn("inline-block size-1.5 rounded-full", tone)} aria-hidden />;
}

export function CentralisedForm({ samples }: { samples: Sample[] }) {
  const [src, setSrc] = useState<SourceInput>({ source: "email", text: "" });
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [aiSource, setAiSource] = useState<string>("local");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [extracting, startExtract] = useTransition();
  const [logging, startLog] = useTransition();

  function loadSample(key: string) {
    const s = samples.find((x) => x.key === key);
    if (!s) return;
    setSrc({ source: s.source, text: s.text, subject: s.subject, sender: s.sender, fileName: s.fileName, mimeType: s.mimeType });
    setFields(null);
    setValues({});
  }

  function extract() {
    startExtract(async () => {
      const r = await extractAction(src);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setFields(r.fields);
      setAiSource(r.source);
      setValues(Object.fromEntries(Object.entries(r.fields).filter(([k]) => k !== "description").map(([k, v]) => [k, v.value ?? ""])));
    });
  }

  function logCase() {
    if (!fields) return;
    // Only send values the user changed, so the record shows what came from AI.
    const overrides = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => {
        const ai = fields[k as Key]?.value ?? "";
        return String(v ?? "") !== String(ai ?? "");
      }),
    );
    startLog(async () => {
      const r = await logCaseAction(src, overrides);
      if (r && !r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="grid gap-5 px-6 py-5 xl:grid-cols-2">
      {/* Source */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Source</CardTitle>
            <CardDescription>Email, call transcript, letter or screenshot text.</CardDescription>
          </div>
          <NativeSelect aria-label="Load a demo sample" className="h-8 w-auto max-w-64 text-sm" value="" onChange={(e) => loadSample(e.target.value)}>
            <option value="">Load a demo sample…</option>
            {samples.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Channel</Label>
              <NativeSelect id="source" value={src.source} onChange={(e) => setSrc({ ...src, source: e.target.value })}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s as Source]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sender">Sender</Label>
              <Input id="sender" value={src.sender ?? ""} onChange={(e) => setSrc({ ...src, sender: e.target.value })} placeholder="Name <email>" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={src.subject ?? ""} onChange={(e) => setSrc({ ...src, subject: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text">Content</Label>
            <Textarea id="text" rows={14} value={src.text} onChange={(e) => setSrc({ ...src, text: e.target.value })} className="font-mono text-[12.5px] leading-relaxed" />
          </div>
          {src.fileName && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon icon={Attachment01Icon} size={14} aria-hidden />
              {src.fileName}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={extract} disabled={extracting || !src.text.trim()}>
              <Icon icon={AiBrain01Icon} aria-hidden />
              {extracting ? "Extracting…" : "Extract fields"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Extracted fields */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Extracted fields</CardTitle>
            <CardDescription>Dots show confidence. Edit anything that doesn&apos;t match the source.</CardDescription>
          </div>
          {fields && <SourceBadge source={aiSource} />}
        </CardHeader>
        <CardContent>
          {!fields ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon icon={AiBrain01Icon} />
                </EmptyMedia>
                <EmptyTitle>Nothing extracted yet</EmptyTitle>
                <EmptyDescription>Paste the email, transcript or letter on the left, or load a demo sample, then extract the fields.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              {GROUPS.map((g) => (
                <fieldset key={g.title} className="flex flex-col gap-2.5">
                  <legend className="pb-1 text-xs font-medium text-muted-foreground">{g.title}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.fields.map((f) => {
                      const meta = fields[f.key];
                      const id = `f-${f.key}`;
                      const v = values[f.key];
                      return (
                        <div key={f.key} className={cn("flex flex-col gap-1.5", f.kind === "long" && "sm:col-span-2")}>
                          <Label htmlFor={id} className="flex items-center gap-1.5" title={`${Math.round(meta.confidence * 100)}% · ${meta.rationale}`}>
                            <ConfidenceDot value={meta.confidence} />
                            {f.label}
                            <span className="tabular ml-auto font-normal">{Math.round(meta.confidence * 100)}%</span>
                          </Label>
                          {f.kind === "bool" ? (
                            <NativeSelect id={id} value={v ? "true" : "false"} onChange={(e) => setValues({ ...values, [f.key]: e.target.value === "true" })}>
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </NativeSelect>
                          ) : f.kind === "nature" || f.kind === "lob" ? (
                            <NativeSelect id={id} value={String(v ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                              {f.kind === "lob" && <option value="">Unknown</option>}
                              {(f.kind === "nature" ? NATURES : LINES_OF_BUSINESS).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : f.kind === "long" ? (
                            <Textarea id={id} rows={2} value={String(v ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                          ) : (
                            <Input id={id} value={String(v ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
                <p className="text-xs text-muted-foreground">Logging runs EDS lookup, duplicate check, assessment, allocation and the acknowledgement.</p>
                <Button onClick={logCase} disabled={logging}>
                  <Icon icon={SentIcon} aria-hidden />
                  {logging ? "Logging…" : "Log case"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
