import { useCallback, useEffect, useState } from "react";
import {
  getLoyaltyPrograms,
  getPromotions,
  saveLoyaltyProgram,
  savePromotion,
} from "../../lib/api";
import { showErrorAlert, showSuccessToast } from "../../lib/alerts";
import type { Service } from "../../types/models";

export function LoyaltySettings({
  accessToken,
  services,
  canManage,
}: {
  accessToken: string;
  services: Service[];
  canManage: boolean;
}) {
  const [programs, setPrograms] = useState<Record<string, unknown>[]>([]);
  const [promotions, setPromotions] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("5.º corte grátis");
  const [serviceId, setServiceId] = useState("");
  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      getLoyaltyPrograms(accessToken),
      getPromotions(accessToken),
    ]);
    setPrograms(p);
    setPromotions(c);
  }, [accessToken]);
  useEffect(() => {
    void load().catch((error) =>
      showErrorAlert("Falha ao carregar fidelização", String(error)),
    );
  }, [load]);
  const createCampaign = async () => {
    if (!serviceId)
      return showErrorAlert(
        "Serviço obrigatório",
        "Selecione um serviço elegível.",
      );
    try {
      await savePromotion(accessToken, {
        name,
        department: "barbershop",
        eligible_service_ids: [serviceId],
        threshold_count: 4,
        period: "calendar_month",
        reward_type: "free_eligible_services",
        reward_value: 0,
        max_redemptions_per_period: 0,
        active: true,
      });
      await load();
      showSuccessToast("Campanha criada.");
    } catch (error) {
      showErrorAlert("Não foi possível criar a campanha", String(error));
    }
  };
  const ensureProgram = async () => {
    try {
      const current = programs[0];
      await saveLoyaltyProgram(
        accessToken,
        {
          name: "Fidelização O Capitão",
          points_per_currency: "0.0100",
          currency_value_per_point: "1.0000",
          points_expire_days: 365,
          active: true,
        },
        current?.id as string | undefined,
      );
      await load();
      showSuccessToast("Programa de pontos guardado.");
    } catch (error) {
      showErrorAlert("Não foi possível guardar", String(error));
    }
  };
  return (
    <div className="settings-grid">
      <article className="panel">
        <div className="panel-head">
          <h4>Programa de pontos</h4>
          <span className="chip">
            {programs.length ? "Ativo" : "Por configurar"}
          </span>
        </div>
        <p className="muted">
          Acumula pontos apenas em vendas integralmente pagas e estorna-os
          automaticamente ao cancelar.
        </p>
        <button className="primary-button" disabled={!canManage} onClick={() => void ensureProgram()}>
          Configurar 1 ponto por 100 MT
        </button>
      </article>
      <article className="panel">
        <div className="panel-head">
          <h4>Campanhas automáticas</h4>
          <span className="chip">{promotions.length}</span>
        </div>
        <label>
          Nome
          <input
            disabled={!canManage}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Serviço elegível
          <select
            disabled={!canManage}
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">Selecionar</option>
            {services
              .filter((service) => service.department === "barbershop")
              .map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
          </select>
        </label>
        <button
          className="primary-button"
          disabled={!canManage}
          onClick={() => void createCampaign()}
        >
          Criar regra: após 4, seguintes grátis
        </button>
        <div className="record-list">
          {promotions.map((promotion) => (
            <div
              className="record-row record-row--static"
              key={String(promotion.id)}
            >
              <div className="record-main">
                <strong>{String(promotion.name)}</strong>
                <small>
                  {String(promotion.threshold_count)} compras no mês ·{" "}
                  {String(promotion.reward_type)}
                </small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
