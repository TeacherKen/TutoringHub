"use client";
import { createContext, useContext } from "react";
import type { GameResult } from "@/lib/gameScore";

/**
 * Where a finished round goes. The child's room sets this (the round is saved to the child, for Mr Ken
 * and the family page, and ticks off homework missions). Anywhere else (Mr Ken's games corner) it is
 * not set, so nothing is sent.
 */
export const ReportContext = createContext<((r: GameResult) => void) | null>(null);
export const useReport = () => useContext(ReportContext);
