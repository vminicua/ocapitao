import { useCallback, useEffect, useState } from "react";
import {
  getPurchaseOrders,
  getStockLocations,
  getSuppliers,
  receivePurchaseOrder,
  savePurchaseOrder,
  savePurchaseOrderItem,
  saveStockLocation,
  saveSupplier,
} from "../../lib/api";
import { showErrorAlert, showSuccessToast } from "../../lib/alerts";
import { formatCurrency } from "../../lib/formatters";
import type { Product } from "../../types/models";

type Row = Record<string, unknown>;
export function InventoryAdvanced({
  accessToken,
  products,
  canManage,
  onBack,
}: {
  accessToken: string;
  products: Product[];
  canManage: boolean;
  onBack: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Row[]>([]),
    [locations, setLocations] = useState<Row[]>([]),
    [orders, setOrders] = useState<Row[]>([]);
  const [supplierName, setSupplierName] = useState(""),
    [locationName, setLocationName] = useState("");
  const [supplier, setSupplier] = useState(""),
    [location, setLocation] = useState(""),
    [product, setProduct] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [cost, setCost] = useState("0");
  const load = useCallback(async () => {
    const [s, l, o] = await Promise.all([
      getSuppliers(accessToken),
      getStockLocations(accessToken),
      getPurchaseOrders(accessToken),
    ]);
    setSuppliers(s);
    setLocations(l);
    setOrders(o);
  }, [accessToken]);
  useEffect(() => {
    void load().catch((error) =>
      showErrorAlert("Inventário avançado", String(error)),
    );
  }, [load]);
  const createSupplier = async () => {
    try {
      await saveSupplier(accessToken, { name: supplierName, active: true });
      setSupplierName("");
      await load();
    } catch (error) {
      showErrorAlert("Fornecedor inválido", String(error));
    }
  };
  const createLocation = async () => {
    try {
      await saveStockLocation(accessToken, {
        name: locationName,
        department: "shared",
        active: true,
      });
      setLocationName("");
      await load();
    } catch (error) {
      showErrorAlert("Localização inválida", String(error));
    }
  };
  const createOrder = async () => {
    try {
      const number = `PO-${Date.now()}`;
      const order = (await savePurchaseOrder(accessToken, {
        number,
        supplier,
        location,
        status: "ordered",
      })) as Row;
      await savePurchaseOrderItem(accessToken, {
        order: order.id,
        product,
        quantity_ordered: quantity,
        unit_cost: cost,
      });
      await load();
      showSuccessToast(`Encomenda ${number} criada.`);
    } catch (error) {
      showErrorAlert("Não foi possível criar a encomenda", String(error));
    }
  };
  const receive = async (order: Row) => {
    try {
      const items = (order.items as Row[])
        .filter(
          (item) =>
            Number(item.quantity_received) < Number(item.quantity_ordered),
        )
        .map((item) => ({
          item_id: item.id,
          quantity:
            Number(item.quantity_ordered) - Number(item.quantity_received),
        }));
      await receivePurchaseOrder(accessToken, String(order.id), items);
      await load();
      showSuccessToast("Mercadoria recebida e stock atualizado.");
    } catch (error) {
      showErrorAlert("Falha na receção", String(error));
    }
  };
  return (
    <section className="module-layout">
      <div className="module-header">
        <div className="stock-breadcrumb">
          <button className="ghost-button stock-back-btn" onClick={onBack}>
            ← Stock
          </button>
          <div>
            <p className="eyebrow">Stock · Operações</p>
            <h3 className="section-title">Compras e armazenagem</h3>
          </div>
        </div>
      </div>
      <div className="settings-grid">
        <article className="panel">
          <div className="panel-head">
            <h4>Fornecedores</h4>
            <span className="chip">{suppliers.length}</span>
          </div>
          <div className="form-row">
            <input
              placeholder="Nome do fornecedor"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
            <button
              className="primary-button"
              disabled={!canManage || !supplierName}
              onClick={() => void createSupplier()}
            >
              Adicionar
            </button>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <h4>Localizações de stock</h4>
            <span className="chip">{locations.length}</span>
          </div>
          <div className="form-row">
            <input
              placeholder="Ex.: Armazém central"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
            <button
              className="primary-button"
              disabled={!canManage || !locationName}
              onClick={() => void createLocation()}
            >
              Adicionar
            </button>
          </div>
        </article>
      </div>
      <article className="panel">
        <div className="panel-head">
          <h4>Nova encomenda</h4>
          <span className="chip">Receção com custo médio</span>
        </div>
        <div className="form-grid">
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Fornecedor</option>
            {suppliers.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.name)}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">Destino</option>
            {locations.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.name)}
              </option>
            ))}
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Artigo</option>
            {products.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantidade"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Custo unitário"
          />
          <button
            className="primary-button"
            disabled={!canManage || !supplier || !location || !product}
            onClick={() => void createOrder()}
          >
            Criar encomenda
          </button>
        </div>
      </article>
      <article className="panel">
        <div className="panel-head">
          <h4>Encomendas</h4>
          <span className="chip">{orders.length}</span>
        </div>
        <div className="record-list">
          {orders.map((order) => (
            <div
              className="record-row record-row--static"
              key={String(order.id)}
            >
              <div className="record-main">
                <strong>{String(order.number)}</strong>
                <small>
                  {String(order.supplier_name)} · {String(order.location_name)}{" "}
                  · {formatCurrency(order.subtotal as string)}
                </small>
              </div>
              <span className="chip">{String(order.status)}</span>
              {canManage && !["received", "cancelled"].includes(String(order.status)) && (
                <button
                  className="primary-button"
                  onClick={() => void receive(order)}
                >
                  Receber tudo
                </button>
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
