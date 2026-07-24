import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncService } from "./sync.service";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const postMock = vi.mocked(axios.post);
const getMock = vi.mocked(axios.get);

describe("SyncService Fedequinas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía el XLSX al endpoint de vista previa", async () => {
    postMock.mockResolvedValue({ data: { data: {} } });
    const file = new File(["xlsx"], "feria.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await syncService.previewFedequinas("FEH_FERIAS", file);

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe("/api/sync/fedequinas/FEH_FERIAS/preview");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
  });

  it("envía archivo, token y checksum al aplicar", async () => {
    postMock.mockResolvedValue({ data: { data: {} } });
    const file = new File(["xlsx"], "feria.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await syncService.applyFedequinas("FEH_FERIAS", file, "preview-token", "checksum-123");

    expect(postMock).toHaveBeenCalledOnce();
    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe("/api/sync/fedequinas/FEH_FERIAS/apply");
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get("file")).toBe(file);
    expect(formData.get("previewToken")).toBe("preview-token");
    expect(formData.get("checksum")).toBe("checksum-123");
  });

  it("codifica el identificador al consultar una feria", async () => {
    getMock.mockResolvedValue({ data: { data: { fairExternalId: "FERIA / 1", steps: [] } } });

    await syncService.getFedequinasFairStatus("FERIA / 1");

    expect(getMock).toHaveBeenCalledWith(
      "/api/sync/fedequinas/fairs/FERIA%20%2F%201/status"
    );
  });
});
