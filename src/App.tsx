import {
  BrainCircuit,
  ChevronRight,
  Database,
  Info,
  RefreshCcw,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  defaultDemoState,
  exampleForecastInput,
  exampleInventoryInput,
  historicalSales,
  historicalCostCategories,
  ingredients,
  menuItems,
  previousWeekSummary,
  sampleSensorReadings,
  weeklyData,
} from "./data/demoData";
import {
  eventLabels,
  formatCurrency,
  formatKg,
  getKoreanDay,
  isForecastReady,
  isOrderInputReady,
  runSimulation,
  weatherLabels,
} from "./lib/simulation";
import { simulationConfig } from "./lib/simulationConfig";
import type {
  ActualLog,
  DemoState,
  EventType,
  ForecastWeather,
  SimulationResult,
  SensorWasteRecord,
} from "./lib/types";

const storageKey = "foodwise-ai-demo-state";
const routes = [
  { path: "/dashboard", label: "대시보드" },
  { path: "/forecast", label: "수요 예측" },
  { path: "/orders", label: "발주 최적화" },
  { path: "/waste-analysis", label: "음식물쓰레기 분석" },
  { path: "/cost", label: "비용 분석" },
  { path: "/report", label: "주간 리포트" },
];

type ForecastStatus = "IDLE" | "READY" | "ANALYZING" | "COMPLETED";
type OrderStatus = "IDLE" | "READY" | "CALCULATING" | "COMPLETED";

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const recentSeven = historicalSales.slice(-7);
const previousSeven = historicalSales.slice(-14, -7);
const recentVisitorAverage = Math.round(
  average(recentSeven.map((item) => item.visitors)),
);
const previousVisitorAverage = average(
  previousSeven.map((item) => item.visitors),
);
const recentTrendPercent =
  ((recentVisitorAverage - previousVisitorAverage) / previousVisitorAverage) *
  100;

function menuAverage(menuId: string) {
  return Math.round(
    average(recentSeven.map((item) => item.menuSales[menuId] ?? 0)),
  );
}

function useCountUp(value: number, enabled: boolean, duration = 600) {
  const [display, setDisplay] = useState(enabled ? 0 : value);
  useEffect(() => {
    if (!enabled) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const frames = Math.max(1, Math.round(duration / 16));
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / frames, 3);
      setDisplay(Math.round(value * progress));
      if (frame >= frames) {
        window.clearInterval(timer);
        setDisplay(value);
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [value, enabled, duration]);
  return display;
}

function AIStatus({ state }: { state: "ANALYZING" | "READY" }) {
  return (
    <div className={`ai-status ${state.toLowerCase()}`}>
      <span />
      <b>FOODWISE AI</b>
      <small>{state}</small>
    </div>
  );
}

function CountUpNumber({
  value,
  suffix = "",
  duration = 600,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const display = useCountUp(value, true, duration);
  return (
    <>
      {display}
      {suffix}
    </>
  );
}

function useStoredState() {
  const [state, setState] = useState<DemoState>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const restored = stored
        ? { ...defaultDemoState, ...JSON.parse(stored) }
        : defaultDemoState;
      return {
        ...defaultDemoState,
        restaurant: restored.restaurant ?? defaultDemoState.restaurant,
        actualLog: restored.actualLog ?? null,
        operationHistory: restored.operationHistory ?? [],
        wasteHistory: Array.isArray(restored.wasteHistory)
          ? restored.wasteHistory.filter(
              (record: SensorWasteRecord) =>
                record.source === "prototype-load-cell" &&
                Number.isFinite(record.totalKg),
            )
          : [],
      };
    } catch {
      return defaultDemoState;
    }
  });

  useEffect(
    () => localStorage.setItem(storageKey, JSON.stringify(state)),
    [state],
  );

  const reset = () => {
    localStorage.removeItem(storageKey);
    setState({
      ...defaultDemoState,
      inventory: { ...defaultDemoState.inventory },
    });
  };

  return { state, setState, reset };
}

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (nextPath: string) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return { path, navigate };
}

function TopNav({
  path,
  state,
  reset,
  navigate,
}: {
  path: string;
  state: DemoState;
  reset: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <header className="top-nav">
      <div className="nav-inner">
        <button
          className="wordmark"
          onClick={() => navigate("/")}
          aria-label="FOODWISE 홈"
        >
          FOODWISE
          <span />
        </button>
        <nav className="main-nav" aria-label="주요 메뉴">
          {routes.map((route) => (
            <button
              key={route.path}
              className={path === route.path ? "active" : ""}
              onClick={() => navigate(route.path)}
            >
              {route.label}
            </button>
          ))}
        </nav>
        <div className="account">
          <button
            className="reset-button"
            onClick={reset}
            title="데모 초기화"
            aria-label="데모 초기화"
          >
            <RefreshCcw size={15} />
          </button>
          <span>{state.restaurant.name}</span>
          <i aria-hidden="true">경</i>
        </div>
      </div>
    </header>
  );
}

function AppShell({
  children,
  state,
  reset,
  path,
  navigate,
}: {
  children: ReactNode;
  state: DemoState;
  reset: () => void;
  path: string;
  navigate: (path: string) => void;
}) {
  return (
    <div className={path === "/" ? "site landing-site" : "site app-site"}>
      <TopNav path={path} state={state} reset={reset} navigate={navigate} />
      <main className={path === "/" ? "" : "page"}>{children}</main>
    </div>
  );
}

function ArrowButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  secondary = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      className={`action-button${secondary ? " secondary" : ""}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
      <ChevronRight size={17} />
    </button>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <div>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

function LogicModal({
  kind,
  onClose,
}: {
  kind: "forecast" | "orders" | "waste";
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="계산 방식 설명"
    >
      <section className="logic-modal">
        <button className="modal-close" onClick={onClose} aria-label="닫기">
          <X size={19} />
        </button>
        <span className="eyebrow">HOW IT WORKS</span>
        <h2>
          {kind === "forecast"
            ? "수요는 어떻게 예측하나요?"
            : kind === "waste"
              ? "조리량은 어떻게 추천하나요?"
              : "발주량은 어떻게 계산하나요?"}
        </h2>
        {kind === "forecast" ? (
          <>
            <p>
              예약 인원, 요일, 날씨, 최근 판매 흐름을 함께 반영해 예상 방문객과
              메뉴별 수요를 계산합니다.
            </p>
            <div className="logic-flow">
              <div>
                <b>INPUT</b>
                <span>예약 · 날씨 · 요일 · 판매</span>
              </div>
              <ChevronRight />
              <div>
                <b>FORECAST</b>
                <span>수요 패턴 계산</span>
              </div>
              <ChevronRight />
              <div>
                <b>OUTPUT</b>
                <span>방문객 · 메뉴 수요</span>
              </div>
            </div>
          </>
        ) : kind === "waste" ? (
          <>
            <p>
              예상 판매량과 메뉴별 과거 잔반 데이터를 함께 반영하여 과잉 조리를
              줄이기 위한 권장 조리량을 계산합니다.
            </p>
            <div className="logic-flow">
              <div>
                <b>INPUT</b>
                <span>예상 판매량 + 과거 잔반 패턴</span>
              </div>
              <ChevronRight />
              <div>
                <b>ANALYSIS</b>
                <span>폐기 위험 분석</span>
              </div>
              <ChevronRight />
              <div>
                <b>OUTPUT</b>
                <span>추천 조리량</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <p>
              AI가 예측한 메뉴 판매량을 레시피 데이터로 식자재 수량으로
              변환하고, 현재 재고를 차감합니다.
            </p>
            <div className="formula-modal">
              <span>AI 예상 판매량</span>
              <b>×</b>
              <span>1인분 식자재 사용량</span>
              <b>−</b>
              <span>현재 재고</span>
              <strong>= 추천 발주량</strong>
            </div>
          </>
        )}
        <small>
          프로토타입 시뮬레이션 · 실제 운영 데이터가 확보되면 검증된 모델
          파라미터로 교체할 수 있습니다.
        </small>
      </section>
    </div>
  );
}

function DataUsed({
  state,
  result,
  onClose,
}: {
  state: DemoState;
  result: SimulationResult;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="사용 데이터"
    >
      <section className="data-modal">
        <button className="modal-close" onClick={onClose} aria-label="닫기">
          <X size={19} />
        </button>
        <span className="eyebrow">DATA USED</span>
        <h2>이번 예측에 사용된 데이터</h2>
        <dl>
          <div>
            <dt>예약</dt>
            <dd>{state.reservationCount}명</dd>
          </div>
          <div>
            <dt>날씨</dt>
            <dd>
              {state.weather ? weatherLabels[state.weather] : "-"} /{" "}
              {state.temperature}℃
            </dd>
          </div>
          <div>
            <dt>요일</dt>
            <dd>{result.dayLabel}</dd>
          </div>
          <div>
            <dt>최근 7일 평균</dt>
            <dd>{recentVisitorAverage}명</dd>
          </div>
          <div>
            <dt>최근 판매 추세</dt>
            <dd>
              {recentTrendPercent >= 0 ? "+" : ""}
              {recentTrendPercent.toFixed(1)}%
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Landing({ navigate }: { navigate: (path: string) => void }) {
  const exampleResult = runSimulation({
    ...defaultDemoState,
    ...exampleForecastInput,
    hasForecast: true,
    inventory: exampleInventoryInput,
  });
  const topMenu = exampleResult.menuPredictions[0];
  const orderCount = exampleResult.ingredientNeeds.filter(
    (item) => item.recommendedOrder > 0,
  ).length;
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">FOODWISE AI</span>
          <h1>
            내일의 식사를
            <br />
            오늘 더 정확하게.
          </h1>
          <p>
            예약, 날씨, 판매 흐름을 바탕으로
            <br />
            필요한 만큼 준비하고 낭비를 줄입니다.
          </p>
          <div className="hero-actions">
            <ArrowButton onClick={() => navigate("/dashboard")}>
              FOODWISE 시작하기
            </ArrowButton>
            <button
              className="text-button"
              onClick={() =>
                document
                  .getElementById("data-flow")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              서비스 보기 <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="live-preview" aria-label="FOODWISE 제품 예시">
          <div className="preview-inputs">
            <div>
              <span>예약</span>
              <strong>{exampleForecastInput.reservationCount}</strong>
            </div>
            <div>
              <span>날씨</span>
              <strong>맑음</strong>
            </div>
            <div>
              <span>판매 추세</span>
              <strong>+{recentTrendPercent.toFixed(1)}%</strong>
            </div>
          </div>
          <div className="preview-core">
            <small>내일 예상</small>
            <strong>{exampleResult.expectedVisitors}</strong>
            <span>명</span>
          </div>
          <svg viewBox="0 0 520 380" aria-hidden="true">
            <path d="M90 70 C170 80 165 165 218 176" />
            <path d="M90 190 C165 190 170 190 214 190" />
            <path d="M90 310 C170 300 170 220 218 204" />
            <path d="M305 184 C355 176 365 118 430 112" />
            <path d="M305 198 C360 210 365 276 430 286" />
          </svg>
          <div className="preview-outputs">
            <div>
              <span>TOP MENU</span>
              <strong>
                {topMenu.name} <b>{topMenu.predicted}</b>
              </strong>
            </div>
            <div>
              <span>발주 필요</span>
              <strong>{orderCount} items</strong>
            </div>
          </div>
          <footer>
            LIVE FOODWISE PREVIEW <i>예시</i>
          </footer>
        </div>
        <div className="hero-principles">
          <span>예측하고</span>
          <span>계산하고</span>
          <span>기록합니다</span>
        </div>
      </section>
      <section className="landing-system" id="data-flow">
        <header>
          <span className="eyebrow">CONNECTED SYSTEM</span>
          <h2>
            데이터가 운영 결정으로
            <br />
            이어지는 과정.
          </h2>
          <p>
            각 기능은 따로 움직이지 않습니다.
            <br />
            입력부터 기록까지 하나의 흐름으로 연결됩니다.
          </p>
        </header>
        <div className="system-stages">
          <article>
            <b>01 · DATA</b>
            <h3>운영 데이터</h3>
            <p>
              판매 · 예약 · 날씨
              <br />
              재고 · 잔반
            </p>
          </article>
          <ChevronRight />
          <article className="accent">
            <b>02 · AI ANALYSIS</b>
            <h3>패턴 분석</h3>
            <p>
              수요 예측 · 음식물쓰레기 측정
              <br />
              메뉴별 판매량
            </p>
          </article>
          <ChevronRight />
          <article>
            <b>03 · OPERATION</b>
            <h3>운영 결정</h3>
            <p>
              조리량 · 발주량
              <br />
              비용 관리 · 리포트
            </p>
          </article>
        </div>
      </section>
      <section className="landing-loop">
        <span>운영 데이터 입력</span>
        <ChevronRight />
        <span>AI 수요 예측</span>
        <ChevronRight />
        <span>발주 최적화</span>
        <ChevronRight />
        <span>잔반 기록</span>
        <ChevronRight />
        <span>주간 리포트</span>
      </section>
      <section className="landing-cta">
        <h2>
          내일은
          <br />
          얼마나 준비해야 할까요?
        </h2>
        <ArrowButton onClick={() => navigate("/forecast")}>
          수요 예측 시작하기
        </ArrowButton>
        <small>FOODWISE AI · 2026</small>
      </section>
    </div>
  );
}

function EmptyPrompt({
  title,
  copy,
  action,
  onClick,
}: {
  title: string;
  copy: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <section className="empty-prompt">
      <span>FOODWISE</span>
      <h1>{title}</h1>
      <p>{copy}</p>
      <ArrowButton onClick={onClick}>{action}</ArrowButton>
    </section>
  );
}

function formatKoreanDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function latestUpdate(state: DemoState) {
  const source = state.wasteHistory[state.wasteHistory.length - 1]?.savedAt ?? state.actualLog?.savedAt;
  if (!source) return "예측 완료";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(source));
}

function Dashboard({
  state,
  result,
  orderStatus,
  navigate,
}: {
  state: DemoState;
  result: SimulationResult | null;
  orderStatus: OrderStatus;
  navigate: (path: string) => void;
}) {
  const [showData, setShowData] = useState(false);
  if (!result)
    return (
      <EmptyPrompt
        title="오늘의 FOODWISE를 준비해볼까요?"
        copy="예약과 날씨를 입력하면 수요 예측부터 발주 계획까지 하나의 흐름으로 연결됩니다."
        action="수요 예측 시작"
        onClick={() => navigate("/forecast")}
      />
    );
  const menuResults = result.menuPredictions
    .filter((item) => item.id !== "rice-bowl")
    .slice(0, 3);
  const maxDemand = Math.max(...menuResults.map((item) => item.predicted));
  const pork = menuResults.find((item) => item.id === "pork")!;
  const porkDelta = pork.predicted - menuAverage("pork");
  const totalMenuDemand = result.menuPredictions.reduce(
    (sum, item) => sum + item.predicted,
    0,
  );
  const latestWaste = state.wasteHistory[state.wasteHistory.length - 1];
  const orderCount = result.ingredientNeeds.filter(
    (item) => item.recommendedOrder > 0,
  ).length;
  return (
    <div className="dashboard-page fade-in">
      <header className="dashboard-header">
        <div>
          <span>오늘의 운영 브리핑</span>
          <h1>{formatKoreanDate(state.forecastDate)}</h1>
        </div>
        <div>
          <span>최근 업데이트</span>
          <strong>{latestUpdate(state)}</strong>
        </div>
      </header>
      <section className="dashboard-primary">
        <article className="forecast-card">
          <button
            className="data-used-button"
            onClick={() => setShowData(true)}
          >
            <Database size={15} /> DATA USED
          </button>
          <span>내일 예상 방문객</span>
          <div className="primary-number">
            <strong>{result.expectedVisitors}</strong>
            <b>명</b>
          </div>
          <p>
            예약 {state.reservationCount}명 대비{" "}
            <em>
              {result.reservationDelta >= 0 ? "+" : ""}
              {result.reservationDelta}명
            </em>
          </p>
          <div className="factor-strip">
            <h2>AI 예측 근거</h2>
            <div>
              <span>
                <small>예약 인원</small>
                <b>높은 영향</b>
                <em>↑</em>
              </span>
              <span>
                <small>최근 판매 추세</small>
                <b>높은 영향</b>
                <em>↑</em>
              </span>
              <span>
                <small>요일</small>
                <b>보통</b>
                <em>→</em>
              </span>
              <span>
                <small>날씨</small>
                <b>낮은 영향</b>
                <em>→</em>
              </span>
            </div>
          </div>
        </article>
        <aside className="recommend-card">
          <span className="eyebrow">오늘의 추천</span>
          <div>
            <b>01</b>
            <h3>{pork.name}</h3>
            <p>
              평소보다 약 {Math.abs(porkDelta)}인분{" "}
              {porkDelta >= 0 ? "더" : "덜"} 준비하세요.
            </p>
          </div>
          <div>
            <b>02</b>
            <h3>{latestWaste ? "음식물쓰레기 기록" : "샐러드"}</h3>
            <p>{latestWaste ? `최근 저장된 모의 측정량은 ${latestWaste.totalKg.toFixed(1)}kg입니다.` : "지난 운영 기록에서 잔반 비율이 높았습니다. 초기 준비량을 확인해보세요."}</p>
          </div>
          {latestWaste ? (
            <button onClick={() => navigate("/waste-analysis")}>
              음식물쓰레기 분석 보기 <ChevronRight size={15} />
            </button>
          ) : null}
        </aside>
      </section>
      <section className="compact-kpis dashboard-kpis">
        <article>
          <span>예상 판매량</span>
          <strong>{totalMenuDemand.toLocaleString("ko-KR")}인분</strong>
          <small>메뉴별 예측 합계</small>
        </article>
        <article>
          <span>예상 폐기량</span>
          <strong>약 {result.estimatedWaste.toFixed(1)}kg</strong>
          <small>과거 잔반 데이터 기반</small>
        </article>
        <article>
          <span>추천 발주 비용</span>
          <strong>
            {orderStatus === "COMPLETED"
              ? formatCurrency(result.recommendedCost)
              : "발주 계산 필요"}
          </strong>
          <small>
            {orderStatus === "COMPLETED"
              ? `${orderCount}개 품목 발주`
              : "재고 입력 후 계산"}
          </small>
        </article>
        {latestWaste ? (
          <article>
            <span>최근 음식물쓰레기 기록</span>
            <strong>{latestWaste.totalKg.toFixed(1)}kg</strong>
            <small>무게 센서 시뮬레이션</small>
          </article>
        ) : null}
      </section>
      <section className="demand-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MENU FORECAST</span>
            <h2>메뉴별 예상 수요</h2>
          </div>
          <button className="text-button" onClick={() => navigate("/forecast")}>
            자세히 보기 <ChevronRight size={15} />
          </button>
        </div>
        <div className="demand-bars">
          {menuResults.map((menu) => {
            const avg = menuAverage(menu.id);
            return (
              <div key={menu.id}>
                <strong>{menu.name}</strong>
                <span className="bar-track">
                  <i
                    style={{ width: `${(menu.predicted / maxDemand) * 100}%` }}
                  />
                  <em
                    style={{
                      left: `${Math.min(96, (avg / maxDemand) * 100)}%`,
                    }}
                    title={`최근 평균 ${avg}인분`}
                  />
                </span>
                <b>{menu.predicted}</b>
                <small>최근 평균 {avg}</small>
              </div>
            );
          })}
        </div>
        <p className="chart-note">
          <i /> 최근 평균 위치
        </p>
      </section>
      {showData ? (
        <DataUsed
          state={state}
          result={result}
          onClose={() => setShowData(false)}
        />
      ) : null}
    </div>
  );
}

function Forecast({
  state,
  setState,
  result,
  status,
  setStatus,
  setOrderStatus,
  navigate,
}: {
  state: DemoState;
  setState: (state: DemoState) => void;
  result: SimulationResult | null;
  status: ForecastStatus;
  setStatus: (status: ForecastStatus) => void;
  setOrderStatus: (status: OrderStatus) => void;
  navigate: (path: string) => void;
}) {
  const [draft, setDraft] = useState(state);
  const [step, setStep] = useState(0);
  const [showLogic, setShowLogic] = useState(false);
  const [showWasteLogic, setShowWasteLogic] = useState(false);
  const [showData, setShowData] = useState(false);
  const steps = [
    "예약 데이터 확인",
    "최근 판매 패턴 분석",
    "요일·날씨 변수 반영",
    "메뉴별 수요 계산",
    "예측 완료",
  ];
  useEffect(() => setDraft(state), [state]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isForecastReady(draft)) return;
    setStatus("ANALYZING");
    setOrderStatus("IDLE");
    setStep(0);
    const interval = window.setInterval(
      () => setStep((current) => Math.min(current + 1, steps.length - 1)),
      420,
    );
    window.setTimeout(() => {
      window.clearInterval(interval);
      setState({
        ...draft,
        hasForecast: true,
        hasOrderCalculation: false,
        forecastCreatedAt: new Date().toISOString(),
      });
      setStatus("COMPLETED");
    }, 2050);
  };
  const update = (patch: Partial<DemoState>) => {
    const next = { ...draft, ...patch, hasForecast: false };
    setDraft(next);
    setStatus(isForecastReady(next) ? "READY" : "IDLE");
    setOrderStatus("IDLE");
  };
  const chartData = result
    ? [
        ...recentSeven.map((item) => ({
          day: item.date.slice(5),
          visitors: item.visitors,
          forecast: null,
        })),
        { day: "내일", visitors: null, forecast: result.expectedVisitors },
      ]
    : [];
  const menuResults =
    result?.menuPredictions
      .filter((item) => item.id !== "rice-bowl")
      .slice(0, 3) ?? [];
  return (
    <div className="forecast-page">
      <PageTitle
        eyebrow="STEP 01"
        title="AI 수요 예측"
        subtitle="운영 데이터와 최근 판매 흐름을 함께 분석합니다."
        action={
          <button className="how-button" onClick={() => setShowLogic(true)}>
            <Info size={15} /> 어떻게 계산되나요?
          </button>
        }
      />
      <form className="forecast-input-card" onSubmit={submit}>
        <div className="input-card-heading">
          <div>
            <h2>운영 데이터 입력</h2>
            <p>내일 영업에 영향을 주는 정보를 입력해주세요.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = {
                ...draft,
                ...exampleForecastInput,
                hasForecast: false,
                hasOrderCalculation: false,
              };
              setDraft(next);
              setStatus("READY");
              setOrderStatus("IDLE");
            }}
          >
            발표 예시 불러오기
          </button>
        </div>
        <div className="forecast-fields">
          <label>
            <span>예측 날짜</span>
            <input
              value={draft.forecastDate}
              type="date"
              onChange={(e) => update({ forecastDate: e.target.value })}
            />
          </label>
          <label>
            <span>예약 인원</span>
            <div className="unit-input">
              <input
                value={draft.reservationCount}
                type="number"
                min={0}
                placeholder="280"
                onChange={(e) =>
                  update({
                    reservationCount:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
              <b>명</b>
            </div>
          </label>
          <label>
            <span>날씨</span>
            <select
              value={draft.weather}
              onChange={(e) =>
                update({ weather: e.target.value as ForecastWeather })
              }
            >
              <option value="">선택</option>
              {Object.entries(weatherLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>기온</span>
            <div className="unit-input">
              <input
                value={draft.temperature}
                type="number"
                placeholder="24"
                onChange={(e) =>
                  update({
                    temperature:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
              <b>℃</b>
            </div>
          </label>
          <label>
            <span>이벤트</span>
            <select
              value={draft.event}
              onChange={(e) => update({ event: e.target.value as EventType })}
            >
              {Object.entries(eventLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="recent-data">
          <span>
            <small>최근 7일 평균 방문객</small>
            <strong>{recentVisitorAverage}명</strong>
          </span>
          <span>
            <small>최근 판매 추세</small>
            <strong>
              {recentTrendPercent >= 0 ? "+" : ""}
              {recentTrendPercent.toFixed(1)}%
            </strong>
          </span>
          <p>
            <Database size={16} /> 저장된 판매 기록에서 자동으로 반영됩니다.
          </p>
        </div>
        <ArrowButton
          type="submit"
          disabled={!isForecastReady(draft) || status === "ANALYZING"}
        >
          AI 수요 분석 시작
        </ArrowButton>
      </form>
      {status === "ANALYZING" ? (
        <section className="analysis-progress">
          <AIStatus state="ANALYZING" />
          <BrainCircuit size={25} />
          <h2>수요 패턴을 분석하고 있습니다.</h2>
          <div className="analysis-data-flow">
            <span>
              <small>예약</small>
              <b>{draft.reservationCount}명</b>
            </span>
            <i>
              <em />
            </i>
            <strong>FOODWISE AI</strong>
            <i>
              <em />
            </i>
            <span>
              <small>날씨</small>
              <b>{draft.weather ? weatherLabels[draft.weather] : "—"}</b>
            </span>
            <span>
              <small>최근 판매</small>
              <b>
                {recentTrendPercent >= 0 ? "+" : ""}
                {recentTrendPercent.toFixed(1)}%
              </b>
            </span>
          </div>
          <div className="analysis-steps">
            {steps.map((label, index) => (
              <span
                className={
                  index < step ? "done" : index === step ? "current" : ""
                }
                key={label}
              >
                <b>{index < step ? "✓" : `0${index + 1}`}</b>
                {label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {status === "COMPLETED" && result ? (
        <section className="forecast-results">
          <header className="result-header cascade cascade-1">
            <div>
              <span className="eyebrow">STEP 02 · AI 예측 결과</span>
              <p>예상 방문객</p>
              <strong>
                <CountUpNumber value={result.expectedVisitors} />
                <small>명</small>
              </strong>
              <em>
                예약 대비 {result.reservationDelta >= 0 ? "+" : ""}
                {result.reservationDelta}명
              </em>
            </div>
            <button
              className="data-used-button"
              onClick={() => setShowData(true)}
            >
              <Database size={15} /> DATA USED
            </button>
          </header>
          <section className="influence-card cascade cascade-2">
            <div>
              <span className="eyebrow">예측 반영 요소</span>
              <h2>이 예측에 영향을 준 요소</h2>
              <p>프로토타입 계산에 반영되는 변수의 상대적 영향입니다.</p>
            </div>
            <div className="influence-list">
              {[
                ["예약 인원", 92, "HIGH IMPACT"],
                ["최근 판매", 82, "HIGH IMPACT"],
                ["요일", 62, "MEDIUM"],
                ["날씨", 42, "LOW"],
              ].map(([name, width, label]) => (
                <span key={String(name)}>
                  <b>{name}</b>
                  <small>{label}</small>
                  <i>
                    <em style={{ width: `${width}%` }} />
                  </i>
                </span>
              ))}
            </div>
          </section>
          <section className="menu-demand-section cascade cascade-3">
            <span className="eyebrow">STEP 03 · 메뉴별 수요</span>
            <div className="menu-result-grid">
              {menuResults.map((menu) => {
                const avg = menuAverage(menu.id);
                const change = ((menu.predicted - avg) / avg) * 100;
                return (
                  <article key={menu.id}>
                    <h3>{menu.name}</h3>
                    <div>
                      <span>{avg}</span>
                      <i>→</i>
                      <strong>
                        <CountUpNumber value={menu.predicted} />
                        <small>인분</small>
                      </strong>
                    </div>
                    <p>
                      <span>최근 평균 → 예상</span>
                      <em className={change >= 0 ? "positive" : "negative"}>
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(1)}%
                      </em>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="waste-forecast-section cascade cascade-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  STEP 04 · 폐기량 예측 · 조리 추천
                </span>
                <h2>내일 예상 잔반</h2>
              </div>
              <button
                className="how-button"
                onClick={() => setShowWasteLogic(true)}
              >
                <Info size={15} /> 어떻게 계산되나요?
              </button>
            </div>
            <div className="waste-forecast-summary">
              <div>
                <span>기존 방식 예상</span>
                <strong>{result.traditionalWasteBaseline.toFixed(1)}kg</strong>
                <small>기존 방식 과거 기록 평균</small>
              </div>
              <div className="primary">
                <span>FOODWISE 추천 적용</span>
                <strong>약 {result.estimatedWaste.toFixed(1)}kg</strong>
                <small>과거 데이터 기반 시뮬레이션</small>
              </div>
              <div>
                <span>예상 감소</span>
                <strong>{result.wasteReduction.toFixed(1)}kg</strong>
                <small>기존 방식 대비</small>
              </div>
            </div>
            <div className="menu-waste-grid">
              {result.menuWastePredictions.map((item) => (
                <article key={item.menuId}>
                  <h3>{item.name}</h3>
                  <dl>
                    <div>
                      <dt>예상 판매</dt>
                      <dd>{item.predictedSales}인분</dd>
                    </div>
                    <div>
                      <dt>과거 잔반율</dt>
                      <dd>{(item.historicalWasteRate * 100).toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt>폐기 위험</dt>
                      <dd className={`risk-${item.wasteRisk}`}>
                        {item.wasteRisk}
                      </dd>
                    </div>
                    <div>
                      <dt>추천 조리</dt>
                      <dd>{item.recommendedCookingAmount}인분</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
          <section className="trend-chart cascade cascade-4">
            <div>
              <span className="eyebrow">VISITOR TREND</span>
              <h2>최근 7일 방문객 + 내일 예측</h2>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
                <Tooltip />
                <Line
                  isAnimationActive
                  type="monotone"
                  dataKey="visitors"
                  name="실제 방문객"
                  stroke="#7d847e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  isAnimationActive
                  type="monotone"
                  dataKey="forecast"
                  name="내일 예측"
                  stroke="#1f6b45"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
          <div className="result-next">
            <ArrowButton onClick={() => navigate("/orders")}>
              발주량 계산하기
            </ArrowButton>
          </div>
        </section>
      ) : null}
      {status === "IDLE" || status === "READY" ? (
        <section className="forecast-empty">
          <BrainCircuit size={26} />
          <p>
            입력한 운영 데이터와 최근 판매 기록을 바탕으로
            <br />
            내일의 방문객과 메뉴 수요를 분석합니다.
          </p>
        </section>
      ) : null}
      {showLogic ? (
        <LogicModal kind="forecast" onClose={() => setShowLogic(false)} />
      ) : null}
      {showWasteLogic ? (
        <LogicModal kind="waste" onClose={() => setShowWasteLogic(false)} />
      ) : null}
      {showData && result ? (
        <DataUsed
          state={state}
          result={result}
          onClose={() => setShowData(false)}
        />
      ) : null}
    </div>
  );
}

function Orders({
  state,
  setState,
  result,
  status,
  setStatus,
  navigate,
}: {
  state: DemoState;
  setState: (state: DemoState) => void;
  result: SimulationResult | null;
  status: OrderStatus;
  setStatus: (status: OrderStatus) => void;
  navigate: (path: string) => void;
}) {
  const [showLogic, setShowLogic] = useState(false);
  const [calcStep, setCalcStep] = useState(0);
  if (!result)
    return (
      <EmptyPrompt
        title="먼저 수요를 예측해주세요."
        copy="메뉴 수요가 있어야 레시피와 현재 재고를 연결해 발주량을 계산할 수 있습니다."
        action="수요 예측하기"
        onClick={() => navigate("/forecast")}
      />
    );
  const updateInventory = (id: string, value: string) => {
    const next: DemoState = {
      ...state,
      inventory: {
        ...state.inventory,
        [id]: value === "" ? "" : Number(value),
      },
      hasOrderCalculation: false,
    };
    setState(next);
    setStatus(isOrderInputReady(next) ? "READY" : "IDLE");
  };
  const calculate = () => {
    if (!isOrderInputReady(state)) return;
    setStatus("CALCULATING");
    setCalcStep(0);
    const interval = window.setInterval(
      () => setCalcStep((current) => Math.min(current + 1, 5)),
      260,
    );
    window.setTimeout(() => {
      window.clearInterval(interval);
      setState({ ...state, hasOrderCalculation: true });
      setStatus("COMPLETED");
    }, 1560);
  };
  const porkMenu = result.menuPredictions.find((item) => item.id === "pork")!;
  const porkIngredient = result.ingredientNeeds.find(
    (item) => item.id === "pork",
  )!;
  const porkRecipe = ingredients.find((item) => item.id === "pork")!.recipes[0];
  return (
    <div className="orders-page">
      <PageTitle
        eyebrow="ORDER OPTIMIZATION"
        title="발주 최적화"
        subtitle="AI가 예측한 수요를 실제 식자재 수량으로 변환합니다."
        action={
          <button className="how-button" onClick={() => setShowLogic(true)}>
            <Info size={15} /> 어떻게 계산되나요?
          </button>
        }
      />
      <section
        className={`calculation-flow ${status === "CALCULATING" ? "is-calculating" : ""}`}
      >
        <div className={calcStep >= 0 ? "done" : ""}>
          <span>AI MENU FORECAST</span>
          <strong>{porkMenu.name}</strong>
          <b>{porkMenu.predicted}인분</b>
        </div>
        <ChevronRight />
        <div className={calcStep >= 1 ? "done" : ""}>
          <span>RECIPE DATA</span>
          <strong>돼지고기</strong>
          <b>{porkRecipe.gramsPerServing}g / 1인분</b>
        </div>
        <ChevronRight />
        <div
          className={
            status === "COMPLETED" ||
            (status === "CALCULATING" && calcStep >= 2)
              ? "active"
              : ""
          }
        >
          <span>NEEDED</span>
          <strong>필요 식자재</strong>
          <b>
            {status === "COMPLETED" ||
            (status === "CALCULATING" && calcStep >= 2)
              ? formatKg(porkIngredient.needed)
              : "—"}
          </b>
        </div>
        <ChevronRight />
        <div
          className={status === "CALCULATING" && calcStep >= 3 ? "active" : ""}
        >
          <span>CURRENT INVENTORY</span>
          <strong>현재 재고</strong>
          <b>
            {state.inventory.pork === ""
              ? "입력 필요"
              : formatKg(Number(state.inventory.pork))}
          </b>
        </div>
        <ChevronRight />
        <div
          className={`flow-result ${status === "COMPLETED" || (status === "CALCULATING" && calcStep >= 5) ? "active" : ""}`}
        >
          <span>RECOMMENDED</span>
          <strong>추천 발주</strong>
          <b>
            {status === "COMPLETED" ||
            (status === "CALCULATING" && calcStep >= 5)
              ? formatKg(porkIngredient.recommendedOrder)
              : "—"}
          </b>
        </div>
      </section>
      <section className="inventory-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">STEP 01</span>
            <h2>현재 재고 입력</h2>
          </div>
          <button
            className="text-button"
            onClick={() => {
              const next = {
                ...state,
                inventory: exampleInventoryInput,
                hasOrderCalculation: false,
              };
              setState(next);
              setStatus("READY");
            }}
          >
            발표 예시 재고 불러오기
          </button>
        </div>
        <div className="stock-grid">
          {ingredients.map((ingredient) => (
            <label key={ingredient.id}>
              <span>{ingredient.name}</span>
              <div className="unit-input">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={state.inventory[ingredient.id]}
                  placeholder="0.0"
                  onChange={(e) =>
                    updateInventory(ingredient.id, e.target.value)
                  }
                />
                <b>kg</b>
              </div>
            </label>
          ))}
        </div>
        <div className="inventory-action">
          <ArrowButton
            disabled={!isOrderInputReady(state) || status === "CALCULATING"}
            onClick={calculate}
          >
            {status === "CALCULATING" ? "발주량 계산 중" : "발주량 계산"}
          </ArrowButton>
        </div>
      </section>
      {status === "CALCULATING" ? (
        <section className="order-calculating">
          <AIStatus state="ANALYZING" />
          <span>{porkMenu.predicted}인분</span>
          <i>×</i>
          <span>{porkRecipe.gramsPerServing}g</span>
          <i>→</i>
          <strong>
            {calcStep >= 2 ? formatKg(porkIngredient.needed) : "필요량 계산 중"}
          </strong>
          <i>−</i>
          <span>{state.inventory.pork}kg</span>
          <i>→</i>
          <strong>
            {calcStep >= 5
              ? formatKg(porkIngredient.recommendedOrder)
              : "재고 비교 중"}
          </strong>
        </section>
      ) : null}
      {status === "COMPLETED" ? (
        <section className="order-output cascade cascade-1">
          <div className="section-heading">
            <div>
              <span className="eyebrow">STEP 02</span>
              <h2>추천 발주 결과</h2>
            </div>
            <span className="prototype-label">시스템 계산</span>
          </div>
          <div className="order-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>식자재</th>
                  <th>예상 필요량</th>
                  <th>현재 재고</th>
                  <th>추가 발주</th>
                  <th>단가</th>
                  <th>예상 비용</th>
                </tr>
              </thead>
              <tbody>
                {result.ingredientNeeds.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{formatKg(item.needed)}</td>
                    <td>{formatKg(item.currentStock)}</td>
                    <td className="order-amount">
                      {formatKg(item.recommendedOrder)}
                    </td>
                    <td>{item.unitPrice.toLocaleString("ko-KR")}원/kg</td>
                    <td>{formatCurrency(item.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="cost-comparison">
            <div>
              <span className="eyebrow">COST COMPARISON</span>
              <h2>비용 비교</h2>
              <p>
                FOODWISE를 사용하지 않았다면 계획했던 식자재 구매비용을
                입력해주세요.
              </p>
            </div>
            <label>
              <span>기존 방식 예상 구매비용</span>
              <div className="unit-input">
                <input
                  type="number"
                  min={0}
                  value={state.traditionalPlanCost}
                  placeholder="예: 160000"
                  onChange={(e) =>
                    setState({
                      ...state,
                      traditionalPlanCost:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <b>원</b>
              </div>
            </label>
            <dl>
              <div>
                <dt>기존 방식</dt>
                <dd>
                  {result.traditionalPlanCost === null
                    ? "입력 전"
                    : formatCurrency(result.traditionalPlanCost)}
                </dd>
              </div>
              <div>
                <dt>FOODWISE 추천</dt>
                <dd>{formatCurrency(result.recommendedCost)}</dd>
              </div>
              <div>
                <dt>예상 절감</dt>
                <dd>
                  {result.expectedSavings === null
                    ? "기존 비용 입력 전"
                    : `${result.expectedSavings >= 0 ? formatCurrency(result.expectedSavings) : `${formatCurrency(Math.abs(result.expectedSavings))} 증가`} · ${Math.abs(result.savingRate ?? 0).toFixed(1)}% ${result.expectedSavings >= 0 ? "↓" : "↑"}`}
                </dd>
              </div>
            </dl>
          </section>
          <p className="disclaimer">
            프로토타입 시뮬레이션이며 실제 절감 효과는 현장 데이터와 입력값에
            따라 달라질 수 있습니다.
          </p>
          <div className="result-next">
            <ArrowButton onClick={() => navigate("/waste-analysis")}>
              음식물쓰레기 분석으로 이동
            </ArrowButton>
          </div>
        </section>
      ) : null}
      {showLogic ? (
        <LogicModal kind="orders" onClose={() => setShowLogic(false)} />
      ) : null}
    </div>
  );
}

function WasteAnalysis({
  state,
  setState,
  navigate,
}: {
  state: DemoState;
  setState: (state: DemoState) => void;
  navigate: (path: string) => void;
}) {
  const [saved, setSaved] = useState(false);
  const totalKg = sampleSensorReadings.reduce(
    (sum, reading) => sum + reading.weightKg,
    0,
  );
  const latestReading = sampleSensorReadings[sampleSensorReadings.length - 1];
  const save = () => {
    const savedAt = new Date().toISOString();
    const savedRecord: SensorWasteRecord = {
      source: "prototype-load-cell",
      measuredAt: savedAt,
      meals: sampleSensorReadings.map((reading) => ({ ...reading })),
      totalKg: Math.round(totalKg * 10) / 10,
      savedAt,
    };
    setState({
      ...state,
      wasteHistory: [...state.wasteHistory, savedRecord],
    });
    setSaved(true);
  };
  return (
    <div className="waste-page">
      <PageTitle
        eyebrow="FOOD WASTE · SENSOR DATA"
        title="음식물쓰레기 분석"
        subtitle="수거한 음식물쓰레기의 무게를 기록하고 운영 데이터로 축적합니다."
      />
      <section className="sensor-overview">
        <article className="sensor-total">
          <span className="eyebrow">PROTOTYPE · SIMULATED DATA</span>
          <h2>오늘의 음식물쓰레기</h2>
          <strong>{totalKg.toFixed(1)} <small>kg</small></strong>
          <p>아침 · 점심 · 저녁 모의 측정값의 합계</p>
        </article>
        <article className="sensor-card">
          <span className="eyebrow">SENSOR STATUS</span>
          <h2>무게 센서 (Load Cell)</h2>
          <p>센서 연동 시뮬레이션</p>
          <dl>
            <div><dt>최근 측정</dt><dd>{latestReading.weightKg.toFixed(1)} kg</dd></div>
            <div><dt>상태</dt><dd><span className="sensor-status-dot" />정상 <small>· 시뮬레이션</small></dd></div>
          </dl>
        </article>
      </section>
      <section className="sensor-meals">
        <div className="section-heading"><div><span className="eyebrow">MEASUREMENT LOG</span><h2>식사 시간별 측정</h2></div><small>프로토타입 시뮬레이션 값</small></div>
        <div className="sensor-meal-list">
          {sampleSensorReadings.map((reading) => (
            <div key={reading.id}>
              <strong>{reading.label}</strong>
              <span>{reading.weightKg.toFixed(1)} kg</span>
              <small>측정 완료 <em>· 모의 데이터</em></small>
            </div>
          ))}
        </div>
      </section>
      <section className="sensor-flow-section">
        <span className="eyebrow">DATA FLOW</span>
        <h2>측정값이 다음 운영 데이터가 되기까지</h2>
        <div className="sensor-flow">
          {["음식물 수거", "무게 측정", "데이터 자동 기록", "데이터 축적", "향후 예측 활용"].map((label, index) => (
            <div key={label}><b>{String(index + 1).padStart(2, "0")}</b><span>{label}</span>{index < 4 ? <ChevronRight size={17} /> : null}</div>
          ))}
        </div>
        <p>센서가 연결된 환경을 가정한 흐름입니다. 현재 프로토타입에는 실제 물리 센서가 연결되어 있지 않습니다.</p>
      </section>
      <div className="sensor-save-row">
        <button className="primary-button" onClick={save} disabled={saved}>
          {saved ? "오늘 측정 기록 저장됨" : "오늘 측정 기록 저장"}
        </button>
        {saved ? <button className="text-button" onClick={() => navigate("/report")}>주간 리포트에서 확인 <ChevronRight size={15} /></button> : null}
      </div>
      {saved ? <p className="sensor-saved-message">운영 데이터에 저장되었습니다. 이 모의 측정 기록은 향후 예측 데이터로 활용할 수 있습니다.</p> : null}
      <p className="sensor-disclaimer"><Info size={14} /> 표시된 무게와 센서 상태는 발표용 시뮬레이션 데이터이며 실제 연결 장비의 측정값이 아닙니다. 메뉴별 음식물쓰레기량은 측정하지 않습니다.</p>
    </div>
  );
}

function CostAnalysis({
  result,
  orderStatus,
  navigate,
}: {
  result: SimulationResult | null;
  state: DemoState;
  orderStatus: OrderStatus;
  navigate: (path: string) => void;
}) {
  const total = weeklyData.reduce((sum, item) => sum + item.cost, 0);
  const savings =
    orderStatus === "COMPLETED" ? (result?.expectedSavings ?? null) : null;
  const wasteLoss = Math.round(
    weeklyData.reduce((sum, item) => sum + item.waste, 0) *
      simulationConfig.historicalWasteLossPerKg,
  );
  const categoryTotal = historicalCostCategories.reduce(
    (sum, item) => sum + item.cost,
    0,
  );
  const composition = historicalCostCategories.map(
    (item) =>
      [item.name, Math.round((item.cost / categoryTotal) * 100)] as const,
  );
  const costChange =
    ((total - previousWeekSummary.cost) / previousWeekSummary.cost) * 100;
  const weeklyWaste = weeklyData.reduce((sum, item) => sum + item.waste, 0);
  const wasteChange =
    ((weeklyWaste - previousWeekSummary.wasteKg) /
      previousWeekSummary.wasteKg) *
    100;
  const busyCost = Math.round((weeklyData[4].cost + weeklyData[5].cost) / 2);
  const earlyCost = Math.round(
    weeklyData.slice(0, 4).reduce((sum, item) => sum + item.cost, 0) / 4,
  );
  return (
    <div className="cost-page">
      <PageTitle
        eyebrow="COST ANALYSIS"
        title="이번 주 비용 흐름"
        subtitle="구매 비용과 폐기 손실의 변화를 함께 확인합니다."
      />
      <section className="cost-kpis">
        <article className="primary">
          <span>이번 주 식자재 비용</span>
          <strong>{formatCurrency(total)}</strong>
          <small>지난 7일 구매 기록</small>
        </article>
        {orderStatus === "COMPLETED" ? (
          <article>
            <span>이번 예측 절감</span>
            <strong>
              {savings === null ? "비교 비용 입력 전" : formatCurrency(savings)}
            </strong>
            <small>현재 발주 계획 기준</small>
          </article>
        ) : (
          <article className="session-cost-prompt">
            <span>이번 예측 비용</span>
            <strong>계산 전</strong>
            <small>수요 예측과 발주 계산 후 확인할 수 있습니다.</small>
            <button className="text-button" onClick={() => navigate("/orders")}>
              발주 계산하러 가기 <ChevronRight size={15} />
            </button>
          </article>
        )}
        <article>
          <span>폐기 손실 추정</span>
          <strong>{formatCurrency(wasteLoss)}</strong>
          <small>지난 7일 운영 기록</small>
        </article>
      </section>
      <div className="cost-charts">
        <section className="chart-card">
          <div>
            <span className="eyebrow">7 DAY TREND</span>
            <h2>7일 비용 추이</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin - 10000", "dataMax + 10000"]} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Line
                isAnimationActive
                type="monotone"
                dataKey="cost"
                stroke="#1f6b45"
                strokeWidth={2.5}
                dot={{ fill: "#fff", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="category-card">
          <span className="eyebrow">CATEGORY</span>
          <h2>카테고리별 비용</h2>
          {composition.map(([name, value]) => (
            <div key={name}>
              <span>{name}</span>
              <i>
                <b style={{ width: `${value}%` }} />
              </i>
              <strong>{value}%</strong>
            </div>
          ))}
        </section>
      </div>
      <section className="cost-insights">
        <div>
          <span className="eyebrow">COST DRIVERS</span>
          <h2>비용 변화 원인</h2>
        </div>
        <p>
          <span>금·토 구매비</span>
          <strong>{busyCost > earlyCost ? "↑" : "↓"}</strong>
          <small>
            월~목 일평균 대비 {formatCurrency(Math.abs(busyCost - earlyCost))}
          </small>
        </p>
        <p>
          <span>지난주 대비 구매비</span>
          <strong>{costChange <= 0 ? "↓" : "↑"}</strong>
          <small>{Math.abs(costChange).toFixed(1)}% 변화</small>
        </p>
        <p>
          <span>잔반 발생량</span>
          <strong>{wasteChange <= 0 ? "↓" : "↑"}</strong>
          <small>지난주 대비 {Math.abs(wasteChange).toFixed(1)}% 변화</small>
        </p>
      </section>
    </div>
  );
}

function Report({ state }: { state: DemoState }) {
  const totalCost = weeklyData.reduce((sum, item) => sum + item.cost, 0);
  const totalWaste = weeklyData.reduce((sum, item) => sum + item.waste, 0);
  const wasteChange =
    ((totalWaste - previousWeekSummary.wasteKg) / previousWeekSummary.wasteKg) *
    100;
  const costChange =
    ((totalCost - previousWeekSummary.cost) / previousWeekSummary.cost) * 100;
  const chartData = weeklyData;
  const busiestDay = weeklyData.reduce((best, item) =>
    item.actual - item.forecast > best.actual - best.forecast ? item : best,
  );
  const highestWasteDay = weeklyData.reduce((best, item) =>
    item.waste > best.waste ? item : best,
  );
  const latestSavedWaste = state.wasteHistory[state.wasteHistory.length - 1];
  const latestOperation = state.operationHistory[state.operationHistory.length - 1];
  const koreanDay = (shortDay: string) => `${shortDay}요일`;
  return (
    <article className="report-page">
      <PageTitle
        eyebrow="지난주 운영 데이터 · WEEK 39 · 2026.09.21 — 09.27"
        title="주간 FOODWISE 리포트"
        subtitle="예측, 발주, 운영 기록을 한 주의 흐름으로 정리합니다."
      />
      <section className="report-kpis">
        <div>
          <span>총 방문객</span>
          <strong>
            {weeklyData
              .reduce((sum, item) => sum + item.actual, 0)
              .toLocaleString("ko-KR")}
            명
          </strong>
        </div>
        <div>
          <span>이번 주 식자재 비용</span>
          <strong>{formatCurrency(totalCost)}</strong>
          <small>지난주 대비 {costChange.toFixed(1)}%</small>
        </div>
        <div>
          <span>이번 주 잔반 발생</span>
          <strong>{Math.round(totalWaste)}kg</strong>
          <small>지난주 대비 {wasteChange.toFixed(1)}%</small>
        </div>
      </section>
      <section className="weekly-summary">
        <span className="eyebrow">AI WEEKLY SUMMARY · 프로토타입</span>
        <p>
          이번 주에는 {koreanDay(busiestDay.day)} 방문객이 예상보다 많았습니다.
          <br />
          {koreanDay(highestWasteDay.day)}에는 잔반 발생량이 가장 많았습니다.
          <br />
          <strong>샐러드</strong>는 잔반 비율이 상대적으로 높았습니다.
        </p>
      </section>
      <section className="report-causes">
        <div>
          <span className="eyebrow">CHANGE DRIVERS</span>
          <h2>이번 주 변화 원인</h2>
        </div>
        <p>
          <strong>샐러드 잔반 비율 높음</strong>
          <small>메뉴별 과거 관측 기준</small>
        </p>
        <p>
          <strong>{koreanDay(busiestDay.day)} 방문객 증가</strong>
          <small>
            예측 대비 실제 {busiestDay.actual - busiestDay.forecast}명 증가
          </small>
        </p>
        <p>
          <strong>{koreanDay(highestWasteDay.day)} 잔반 집중</strong>
          <small>이번 주 최고 {highestWasteDay.waste.toFixed(1)}kg 기록</small>
        </p>
      </section>
      {latestSavedWaste ? (
        <section className="report-feedback">
          <span className="eyebrow">NEW FEEDBACK DATA</span>
          <h2>최근 저장된 음식물쓰레기 측정 기록</h2>
          <p>무게 센서 시뮬레이션 · 총 {latestSavedWaste.totalKg.toFixed(1)}kg</p>
          <small>
            프로토타입 모의 데이터로 저장되었습니다. 향후 총 폐기량 예측의 참고 기록이며 실제 센서 연동이나 모델 재학습을 의미하지 않습니다.
          </small>
        </section>
      ) : null}
      {latestOperation ? (
        <section className="report-feedback">
          <span className="eyebrow">NEW OPERATION DATA</span>
          <h2>최근 영업 종료 기록</h2>
          <p>실제 방문객 {latestOperation.visitors}명 · 메뉴 판매 {Object.values(latestOperation.menuSales).reduce((sum, count) => sum + count, 0)}인분</p>
          <small>입력한 실제 운영 데이터가 저장되었으며, 다음 수요·메뉴 예측의 과거 관측으로 반영됩니다.</small>
        </section>
      ) : null}
      <section className="report-chart">
        <div>
          <span className="eyebrow">FORECAST VS ACTUAL</span>
          <h2>예측 방문객과 실제 방문객</h2>
        </div>
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={chartData}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} />
            <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
            <Tooltip />
            <Line
              isAnimationActive
              type="monotone"
              dataKey="forecast"
              name="예측"
              stroke="#8d948e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              isAnimationActive
              type="monotone"
              dataKey="actual"
              name="실제"
              stroke="#1f6b45"
              strokeWidth={2.5}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="next-actions">
        <div>
          <span className="eyebrow">NEXT WEEK ACTION</span>
          <h2>다음 운영에 반영할 항목</h2>
        </div>
        <p>
          <span>샐러드 준비량</span>
          <strong>-8%</strong>
        </p>
        <p>
          <span>금요일 육류 재고</span>
          <strong>+5%</strong>
        </p>
        <p>
          <span>우천 시 전체 조리량</span>
          <strong>-6%</strong>
        </p>
      </section>
    </article>
  );
}

function ClosingLog({
  state,
  setState,
}: {
  state: DemoState;
  setState: (state: DemoState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<{
    visitors: number | "";
    menuSales: Record<string, number | "">;
    inventoryNote: string;
    wasteNote: string;
  }>({
    visitors: "",
    menuSales: Object.fromEntries(menuItems.map((menu) => [menu.id, ""])),
    inventoryNote: "",
    wasteNote: "",
  });
  const readyToSave =
    form.visitors !== "" &&
    menuItems.every((menu) => form.menuSales[menu.id] !== "");
  const save = () => {
    if (!readyToSave) return;
    const savedAt = new Date().toISOString();
    const actualLog: ActualLog = {
      visitors: Number(form.visitors),
      menuSales: Object.fromEntries(
        menuItems.map((menu) => [menu.id, Number(form.menuSales[menu.id])]),
      ),
      inventoryNote: form.inventoryNote,
      wasteNote: form.wasteNote,
      savedAt,
    };
    setState({
      ...state,
      actualLog,
      operationHistory: [
        ...state.operationHistory,
        {
          ...actualLog,
          reservations:
            state.reservationCount === ""
              ? null
              : Number(state.reservationCount),
          operatingDate: state.forecastDate,
        },
      ],
    });
    setOpen(false);
    setToast("오늘의 운영 데이터가 저장되었습니다.");
    window.setTimeout(() => setToast(""), 2600);
  };
  return (
    <>
      <button className="floating-log-button" onClick={() => setOpen(true)}>
        영업 종료 기록
      </button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal">
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              <X size={19} />
            </button>
            <h2>영업 종료 기록</h2>
            <label>
              실제 방문객
              <input
                type="number"
                value={form.visitors}
                onChange={(e) =>
                  setForm({
                    ...form,
                    visitors:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </label>
            <div className="modal-grid">
              {[
                ["pork", "제육볶음"],
                ["stew", "된장찌개"],
                ["salad", "샐러드"],
                ["rice-bowl", "공기밥"],
              ].map(([id, label]) => (
                <label key={id}>
                  {label} 실제 판매량
                  <input
                    type="number"
                    value={form.menuSales[id]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        menuSales: {
                          ...form.menuSales,
                          [id]:
                            e.target.value === "" ? "" : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              남은 재고
              <textarea
                value={form.inventoryNote}
                onChange={(e) =>
                  setForm({ ...form, inventoryNote: e.target.value })
                }
              />
            </label>
            <label>
              잔반 기록
              <textarea
                value={form.wasteNote}
                onChange={(e) =>
                  setForm({ ...form, wasteNote: e.target.value })
                }
              />
            </label>
            <p className="disclaimer">
              축적된 실제 운영 데이터는 향후 예측 모델 개선에 활용할 수
              있습니다.
            </p>
            <div className="button-row right">
              <button
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
              <button
                className="primary-button"
                onClick={save}
                disabled={!readyToSave}
              >
                오늘 기록 저장
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}

export function App() {
  const { state, setState, reset } = useStoredState();
  const { path, navigate } = useRoute();
  const [forecastStatus, setForecastStatus] = useState<ForecastStatus>("IDLE");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("IDLE");
  const result = useMemo(
    () =>
      forecastStatus === "COMPLETED" && isForecastReady(state)
        ? runSimulation(state)
        : null,
    [state, forecastStatus],
  );
  const resetSession = () => {
    reset();
    setForecastStatus("IDLE");
    setOrderStatus("IDLE");
  };
  const normalizedPath =
    path === "/"
      ? "/"
      : routes.some((route) => route.path === path)
        ? path
        : "/dashboard";
  let page: ReactNode;
  if (normalizedPath === "/") page = <Landing navigate={navigate} />;
  else if (normalizedPath === "/dashboard")
    page = (
      <Dashboard
        state={state}
        result={result}
        orderStatus={orderStatus}
        navigate={navigate}
      />
    );
  else if (normalizedPath === "/forecast")
    page = (
      <Forecast
        state={state}
        setState={setState}
        result={result}
        status={forecastStatus}
        setStatus={setForecastStatus}
        setOrderStatus={setOrderStatus}
        navigate={navigate}
      />
    );
  else if (normalizedPath === "/orders")
    page = (
      <Orders
        state={state}
        setState={setState}
        result={result}
        status={orderStatus}
        setStatus={setOrderStatus}
        navigate={navigate}
      />
    );
  else if (normalizedPath === "/waste-analysis")
    page = (
      <WasteAnalysis
        state={state}
        setState={setState}
        navigate={navigate}
      />
    );
  else if (normalizedPath === "/cost")
    page = (
      <CostAnalysis
        result={result}
        state={state}
        orderStatus={orderStatus}
        navigate={navigate}
      />
    );
  else page = <Report state={state} />;
  return (
    <AppShell
      state={state}
      reset={resetSession}
      path={normalizedPath}
      navigate={navigate}
    >
      {page}
      {normalizedPath !== "/" ? (
        <ClosingLog state={state} setState={setState} />
      ) : null}
    </AppShell>
  );
}
