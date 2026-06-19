import { describe, expect, test } from "vitest";
import {
  classifyPymesAutocreateVentaTipo,
  classifyTangoVentaTipo,
} from "../../src/backend/services/tangoV2SyncMapper.js";

describe("clasificacion BA CORP en comisiones Tango", () => {
  test("BA CORP NEW se trata como movil nueva", () => {
    expect(classifyPymesAutocreateVentaTipo(null, "BA CORP NEW")).toEqual({
      negocio: "PYMES",
      product: "movil",
      movement: "NEW",
    });

    expect(classifyTangoVentaTipo(null, "BA CORP NEW")).toEqual({
      family: "movil",
      lineType: "NEW",
    });
  });

  test("BA CORP REN se trata como movil renovacion", () => {
    expect(classifyPymesAutocreateVentaTipo(null, "BA CORP REN")).toEqual({
      negocio: "PYMES",
      product: "movil",
      movement: "REN",
    });

    expect(classifyTangoVentaTipo(null, "BA CORP REN")).toEqual({
      family: "movil",
      lineType: "REN",
    });
  });
});
