"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        window.print();
      }}
    >
      {label}
    </Button>
  );
}

