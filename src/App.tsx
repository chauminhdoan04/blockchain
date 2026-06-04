/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Beef, 
  Plus, 
  Activity, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Info,
  History,
  ShieldCheck,
  Stethoscope,
  RefreshCw,
  LayoutDashboard,
  Bell,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from './lib/utils';
import { COW_MANAGER_ABI, Behavior, BehaviorLabels, BehaviorColors, BehaviorChartColors } from './constants/blockchain';

interface CowActionLog {
  behavior: Behavior;
  timestamp: number;
}

interface Cow {
  id: number;
  name: string;
  behavior: Behavior;
  timestamp: number;
  history?: CowActionLog[];
}

type UserRole = 'owner' | 'doctor' | 'guest';

const SUPPORTED_CHAIN_IDS = new Set<bigint>([31337n, 1337n]);
const HARDHAT_CHAIN_ID = 31337n;

const normalizeChainId = (value: bigint | number | string | null | undefined): bigint | null => {
  if (value === null || value === undefined) return null;

  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    const text = value.trim();
    if (!text) return null;
    return BigInt(text);
  } catch {
    return null;
  }
};

const isSupportedHardhatNetwork = (value: bigint | number | string | null | undefined) => {
  const normalized = normalizeChainId(value);
  return normalized !== null && SUPPORTED_CHAIN_IDS.has(normalized);
};

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [cows, setCows] = useState<Cow[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCowName, setNewCowName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);
  const loadingRef = React.useRef(false);
  const lastLoadRef = React.useRef(0);

  // Prefer env override, then fall back to the known local Hardhat deployment address.
  const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim() || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; 
  const HARDHAT_OWNER_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const currentRole = useMemo<UserRole>(() => {
    if (!account) return 'guest';
    if (isOwner) return 'owner';
    if (isDoctor) return 'doctor';
    return 'guest';
  }, [account, isOwner, isDoctor]);

  const canManageBehavior = currentRole === 'owner' || currentRole === 'doctor';

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${HARDHAT_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${HARDHAT_CHAIN_ID.toString(16)}`,
                chainName: 'Hardhat Localhost',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding network:", addError);
        }
      }

      await refreshBlockchainData();
    }
  };

  const loadBlockchainData = useCallback(async (activeProvider: ethers.BrowserProvider) => {
    if (loadingRef.current) return;

    const now = Date.now();
    if (now - lastLoadRef.current < 1000) return; 
    
    loadingRef.current = true;
    lastLoadRef.current = now;
    setIsLoading(true);
    
    console.log("Syncing blockchain data...");
    
    try {
      const network = await activeProvider.getNetwork();
      const chainIdNum = normalizeChainId(network.chainId);
      if (chainIdNum === null) {
        setError("Không thể đọc chainId từ ví đang kết nối.");
        setContract(null);
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      setChainId(chainIdNum);
      console.log("Network chainId:", chainIdNum.toString());
      console.log("Supported chainIds:", Array.from(SUPPORTED_CHAIN_IDS).map((id) => id.toString()).join(", "));

      if (!isSupportedHardhatNetwork(chainIdNum)) {
        setContract(null);
        setIsOwner(false);
        setIsDoctor(false);
        setError(`Vui lòng chuyển MetaMask sang mạng Hardhat Localhost (Chain ID 31337). Hiện tại: ${chainIdNum.toString()}.`);
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      const accounts = await activeProvider.listAccounts();
      if (accounts.length === 0) {
        console.warn("No accounts found in provider.");
        setAccount(null);
        setBalance("0");
        setContract(null);
        setIsOwner(false);
        setIsDoctor(false);
        setError(null);
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      const signer = await activeProvider.getSigner();
      const userAddress = await signer.getAddress();
      setAccount(userAddress);
      console.log("Connected account:", userAddress);

      const cowContract = new ethers.Contract(contractAddress, COW_MANAGER_ABI, signer);
      setContract(cowContract);

      // Fetch data with individual error handling to avoid collective failure
      const [ethBalance, ownerAddr, doctorStatus, allCowsData] = await Promise.all([
        activeProvider.getBalance(userAddress).catch(e => { console.error("Balance fetch error:", e); return 0n; }),
        cowContract.owner().catch(e => { console.error("Owner fetch error:", e); return ethers.ZeroAddress; }),
        cowContract.isDoctor(userAddress).catch(e => { console.error("Doctor fetch error:", e); return false; }),
        cowContract.getAllCows().catch(e => { console.error("Cows fetch error:", e); return []; })
      ]);

      if (ownerAddr === ethers.ZeroAddress && allCowsData.length === 0) {
        setError("Không thể xác thực contract tại địa chỉ hiện tại. Hãy kiểm tra lại node hoặc contract address.");
      }

      setBalance(ethers.formatEther(ethBalance));
      setIsOwner(ownerAddr.toLowerCase() === userAddress.toLowerCase());
      setIsDoctor(doctorStatus);

      const loadedCows: Cow[] = allCowsData.map((cow: any) => ({
        id: Number(cow.id),
        name: cow.name || "Unknown",
        behavior: Number(cow.currentBehavior || 0) as Behavior,
        timestamp: Number(cow.timestamp || 0),
        history: (cow.history || []).map((log: any) => ({
          behavior: Number(log.behavior || 0) as Behavior,
          timestamp: Number(log.timestamp || 0)
        }))
      }));
      
      setCows(loadedCows);
      setError(null);
      console.log("Blockchain data synced successfully.");
    } catch (err: any) {
      console.error("Blockchain Sync Failed:", err);
      setError("Lỗi: " + (err.reason || err.message));
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [contractAddress]);

  const refreshBlockchainData = useCallback(async () => {
    if (!window.ethereum) return;
    await loadBlockchainData(new ethers.BrowserProvider(window.ethereum));
  }, [loadBlockchainData]);

  // Persistent synchronization
  useEffect(() => {
    if (!window.ethereum) return;
    
    const p = new ethers.BrowserProvider(window.ethereum);
    const sync = () => {
      void refreshBlockchainData();
    };

    const handleAccounts = (accounts: string[]) => {
      console.log("Web3: Accounts changed", accounts);
      if (accounts.length === 0) {
        setAccount(null);
        setBalance("0");
        setContract(null);
        setIsOwner(false);
        setIsDoctor(false);
        setError(null);
      } else {
        sync();
      }
    };

    const handleChain = (chainIdHex: string) => {
      console.log("Web3: Chain changed", chainIdHex);
      setContract(null);
      setIsOwner(false);
      setIsDoctor(false);
      setError(null);
      sync();
    };

    window.ethereum.on('accountsChanged', handleAccounts);
    window.ethereum.on('chainChanged', handleChain);
    
    // Setup Contract Event Listeners for Real-time Updates
    let eventContract: ethers.Contract | null = null;

    const setupListeners = async () => {
      try {
        const accounts = await p.listAccounts();
        if (accounts.length > 0) {
          const signer = await p.getSigner();
          const network = await p.getNetwork();
          
          if (isSupportedHardhatNetwork(network.chainId)) {
            eventContract = new ethers.Contract(contractAddress, COW_MANAGER_ABI, signer);
            
            // Listen for new cows
            eventContract.on("CowAdded", (id, name) => {
              console.log("Realtime: New cow added", name);
              sync(); // Trigger refresh
            });

            // Listen for behavior updates
            eventContract.on("BehaviorUpdated", (id, behavior) => {
              console.log("Realtime: Cow behavior updated", id, behavior);
              sync(); // Trigger refresh
            });
          }
        }

        sync(); // Initial fetch
      } catch (e) {
        console.error("Web3: Listener setup failed", e);
      }
    };

    setupListeners();

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccounts);
      window.ethereum?.removeListener('chainChanged', handleChain);
      if (eventContract) {
        eventContract.removeAllListeners();
      }
    };
  }, [contractAddress, refreshBlockchainData]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("Hãy cài đặt MetaMask để sử dụng ứng dụng này.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null);
      await refreshBlockchainData();
    } catch (err: any) {
      setError("Kết nối thất bại: " + (err.reason || err.message));
    } finally {
      setIsConnecting(false);
    }
  };

  const addCow = async () => {
    if (!newCowName) return;
    
    if (!account) {
      // Simulation mode for Demo
      setIsLoading(true);
      setTxStatus("Mô phỏng: Đang thêm bò...");
      setTimeout(() => {
        const newCow: Cow = {
          id: cows.length + 1,
          name: newCowName,
          behavior: Behavior.Standing,
          timestamp: Date.now() / 1000,
          history: [{ behavior: Behavior.Standing, timestamp: Date.now() / 1000 }]
        };
        setCows([newCow, ...cows]);
        setNewCowName('');
        setIsLoading(false);
        setTxStatus(null);
      }, 800);
      return;
    }

    if (!contract || !isSupportedHardhatNetwork(chainId)) {
      setError("Vui lòng chuyển sang mạng Hardhat trước khi thêm bò.");
      return;
    }

    setIsLoading(true);
    setTxStatus("✍️ Đang đợi bạn ký xác nhận trong MetaMask...");
    try {
      const tx = await contract!.addCow(newCowName);
      setTxStatus("🚀 Giao dịch đã gửi! Đang đợi Blockchain xác nhận...");
      await tx.wait();
      setNewCowName('');
      setTxStatus("✅ Thêm bò thành công!");
      setTimeout(() => setTxStatus(null), 3000);
      setError(null);
    } catch (err: any) {
      console.error("AddCow Error:", err);
      setError("Không thể thêm bò: " + (err.reason || err.message || "Giao dịch bị từ chối"));
    } finally {
      setIsLoading(false);
    }
  };

  const updateBehavior = async (id: number, behavior: Behavior) => {
    if (!account) {
      // Simulation mode for Demo
      setIsLoading(true);
      setTxStatus("Mô phỏng: Đang cập nhật...");
      setTimeout(() => {
        const now = Date.now() / 1000;
        setCows(prevCows => prevCows.map(c => {
          if (c.id === id) {
            return {
              ...c,
              behavior: behavior,
              timestamp: now,
              history: [...(c.history || []), { behavior, timestamp: now }]
            };
          }
          return c;
        }));
        setIsLoading(false);
        setTxStatus(null);
      }, 500);
      return;
    }

    if (!contract || !isSupportedHardhatNetwork(chainId)) {
      setError("Vui lòng chuyển sang mạng Hardhat trước khi cập nhật.");
      return;
    }

    setIsLoading(true);
    setTxStatus("✍️ Đang đợi ký xác thực hành vi...");
    try {
      const tx = await contract.updateBehavior(id, behavior);
      setTxStatus("⏳ Đang cập nhật trạng thái lên Blockchain...");
      await tx.wait();
      setTxStatus("✅ Cập nhật thành công!");
      setTimeout(() => setTxStatus(null), 3000);
      setError(null);
    } catch (err: any) {
      console.error("Update Error:", err);
      setError("Lỗi khi cập nhật trạng thái: " + (err.reason || err.message || "Từ chối giao dịch"));
    } finally {
      setIsLoading(false);
    }
  };

  // Logic calculation for time spent - Improved for visibility
  const calculateStats = (history: CowActionLog[]) => {
    if (!history || history.length === 0) return [];
    
    const times: Record<Behavior, number> = {
      [Behavior.Standing]: 0,
      [Behavior.Eating]: 0,
      [Behavior.Lying]: 0
    };

    const now = Date.now() / 1000;

    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const next = history[i + 1];
      
      // Nếu là bản ghi mới nhất, tính từ lúc đó đến Hiện tại
      // Thêm tối thiểu 300 giây (5 phút) để biểu đồ luôn có dữ liệu hiển thị được
      const endTimestamp = next ? next.timestamp : now;
      let duration = endTimestamp - current.timestamp;
      
      if (!next && duration < 300) duration = 300; // Padding padding for chart visibility
      
      times[current.behavior] += duration;
    }

    return Object.entries(times).map(([behavior, duration]) => ({
      name: BehaviorLabels[Number(behavior) as Behavior],
      value: duration,
      color: BehaviorChartColors[Number(behavior) as Behavior]
    })).filter(it => it.value > 0);
  };

  // Mock data for initial preview
  useEffect(() => {
    if (!account) {
      const now = Date.now() / 1000;
      setCows([
        { 
          id: 1, 
          name: "Bò số 01", 
          behavior: Behavior.Standing, 
          timestamp: now,
          history: [
            { behavior: Behavior.Lying, timestamp: now - 3600 * 5 },
            { behavior: Behavior.Eating, timestamp: now - 3600 * 2 },
            { behavior: Behavior.Standing, timestamp: now - 1800 }
          ]
        },
        { 
          id: 2, 
          name: "Bò số 02", 
          behavior: Behavior.Eating, 
          timestamp: now,
          history: [
            { behavior: Behavior.Standing, timestamp: now - 7200 },
            { behavior: Behavior.Eating, timestamp: now - 3600 }
          ]
        },
      ]);
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-[#fcfdfe] font-sans text-slate-900 selection:bg-indigo-100">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="bg-gradient-to-br from-indigo-600 to-blue-700 p-2 rounded-xl shadow-lg shadow-indigo-200"
            >
              <Beef className="w-6 h-6 text-white" />
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">
                CowChain OS
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-600/80 font-bold uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                Dữ liệu thời gian thực
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all hidden md:block"
            >
              <Bell className="w-5 h-5" />
            </motion.button>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border shadow-sm group relative overflow-hidden",
                account 
                  ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" 
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 shadow-indigo-100"
              )}
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
              <span className="relative z-10">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Kết nối Ví"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-20 relative">
        {/* Network Warning Banner */}
        <AnimatePresence>
          {chainId !== null && !isSupportedHardhatNetwork(chainId) && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 32 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-rose-500/20 p-2.5 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-100">Sai mạng Blockchain</h3>
                    <p className="text-xs text-rose-100/70">Vui lòng chuyển sang <strong>Hardhat Localhost</strong> để thao tác.</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={switchNetwork}
                  className="bg-rose-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 shrink-0"
                >
                  Chuyển Mạng Ngay
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main List Section */}
          <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Tổng Đàn', value: cows.length, icon: Beef, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Đang Ăn', value: cows.filter(c => c.behavior === Behavior.Eating).length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Đang Nghỉ', value: cows.filter(c => c.behavior === Behavior.Lying).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  className="bg-white border border-slate-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-sm"
                >
                  <div className={cn("p-3 rounded-xl", stat.bg)}>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900">{stat.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Hệ Thống Giám Sát</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                <Activity className={cn("w-4 h-4 text-indigo-500", isLoading && "animate-spin")} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                  {isLoading ? 'Đang cập nhật...' : 'Live Sync'}
                </span>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-200 text-xs font-bold"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100 px-2 py-1">Đóng</button>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {cows.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white"
                  >
                    <Beef className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-sm font-bold">Chưa có dữ liệu vật nuôi</p>
                    <p className="text-xs opacity-60">Hãy thêm bò mới từ bảng quản trị</p>
                  </motion.div>
                ) : (
                  cows.map((cow, index) => {
                    const chartData = calculateStats(cow.history || []);
                    return (
                      <motion.div
                        key={cow.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:border-indigo-400/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 relative"
                      >
                        <div className="p-6 relative z-10">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ring-4 ring-indigo-500/0 group-hover:ring-indigo-500/5">
                                <Beef className="w-8 h-8 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{cow.name}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100">#{cow.id}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] font-bold text-slate-400 italic">verified</span>
                                </div>
                              </div>
                            </div>
                            <div className={cn(
                              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border",
                              BehaviorColors[cow.behavior] === "bg-green-600" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                              BehaviorColors[cow.behavior] === "bg-yellow-600" ? "bg-amber-50 text-amber-700 border-amber-100" :
                              "bg-indigo-50 text-indigo-700 border-indigo-100"
                            )}>
                              {BehaviorLabels[cow.behavior].replace("Đang ", "")}
                            </div>
                          </div>

                          {/* Chart / Stats Visual */}
                          <div className="bg-slate-50 rounded-3xl p-5 mb-6 border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                Hoạt động 24h
                              </h4>
                              <div className="h-4 w-px bg-slate-200" />
                              <div className="text-[10px] font-bold text-indigo-600/60">Blockchain Ledger</div>
                            </div>
                            
                            <div className="h-32 flex items-center gap-6">
                              <div className="w-24 h-32 shrink-0 relative">
                                <PieChart width={96} height={128}>
                                    <Pie
                                      data={chartData}
                                      innerRadius={28}
                                      outerRadius={42}
                                      paddingAngle={4}
                                      dataKey="value"
                                      animationDuration={1500}
                                      stroke="#f8fafc"
                                      strokeWidth={2}
                                    >
                                      {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip 
                                      contentStyle={{ 
                                        borderRadius: '16px', 
                                        backgroundColor: '#fff',
                                        border: '1px solid rgba(0,0,0,0.05)', 
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        fontSize: '10px',
                                        fontWeight: 'black',
                                        color: '#1e293b'
                                      }} 
                                    />
                                </PieChart>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                  <History className="w-3 h-3 text-slate-300" />
                                </div>
                              </div>
                              
                              <div className="flex-1 space-y-2.5">
                                {chartData.map((stat, i) => (
                                  <div key={i} className="flex items-center justify-between group/row">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: stat.color }} />
                                      <span className="text-[10px] font-bold text-slate-500 group-hover/row:text-slate-900 transition-colors">{stat.name.replace("Đang ", "")}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${Math.round((stat.value / chartData.reduce((a, b) => a + b.value, 0)) * 100)}%` }}
                                          transition={{ duration: 1.5, ease: "easeOut" }}
                                          className="h-full rounded-full"
                                          style={{ backgroundColor: stat.color }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-black text-slate-600">
                                        {Math.round((stat.value / chartData.reduce((a, b) => a + b.value, 0)) * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 px-1">
                              <Stethoscope className={cn("w-3.5 h-3.5", canManageBehavior ? "text-indigo-600" : "text-slate-300")} />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Management</span>
                              <div className="flex-1 h-px bg-slate-100 ml-2" />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(BehaviorLabels).map(([key, label]) => {
                                const bKey = Number(key) as Behavior;
                                const isActive = cow.behavior === bKey;
                                return (
                                  <motion.button
                                    key={key}
                                    whileHover={!isActive && !isLoading && canManageBehavior ? { y: -2, backgroundColor: 'rgba(99,102,241,0.05)' } : {}}
                                    whileTap={!isActive && !isLoading && canManageBehavior ? { scale: 0.98 } : {}}
                                    onClick={() => updateBehavior(cow.id, bKey)}
                                    disabled={isLoading || (account && !canManageBehavior) || isActive}
                                    className={cn(
                                      "py-2.5 rounded-2xl text-[10px] font-black transition-all border flex flex-col items-center justify-center gap-1 relative overflow-hidden",
                                      isActive
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100"
                                        : "bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    )}
                                  >
                                    {label.replace("Đang ", "")}
                                    {isActive && (
                                      <motion.div 
                                        layoutId={`active-dot-${cow.id}`}
                                        className="w-1 h-1 rounded-full bg-white" 
                                      />
                                    )}
                                  </motion.button>
                                );
                              })}
                            </div>
                            
                            {!canManageBehavior && account && (
                              <p className="text-[9px] text-center text-rose-500/80 font-bold tracking-tight bg-rose-50 py-1.5 rounded-lg border border-rose-100">
                                🔒 Chỉ tài khoản Chủ trại hoặc Bác sĩ mới được quyền cập nhật
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Side Control Board */}
          <div className="lg:col-span-4 space-y-8 order-1 lg:order-2">
            {/* Control Hub Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                <Beef className="w-48 h-48" />
              </div>
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6 border border-white/10">
                  <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black mb-2 tracking-tight">Quản Trị Đàn</h2>
                <p className="text-white/70 text-sm font-medium mb-8">Khai báo và cấp chứng chỉ số cho vật nuôi mới lên mạng Blockchain.</p>
                
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={newCowName}
                      onChange={(e) => setNewCowName(e.target.value)}
                      placeholder="Nhập tên vật nuôi..."
                      className="w-full bg-black/10 border border-white/20 rounded-2xl py-4 px-5 text-sm font-bold placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/30 transition-all text-white"
                    />
                    <Beef className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={addCow}
                    disabled={isLoading || !newCowName}
                    className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                    ) : (
                      <>
                        Ghi Lên Blockchain
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                  
                  {txStatus && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="text-center"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 py-2 rounded-xl text-white animate-pulse">
                        {txStatus}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Wallet Detailed Status */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Xác Thực Người Dùng
                </h3>
                {account && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                )}
              </div>
              
              {!account ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400 font-bold mb-4">Vui lòng kết nối MetaMask để thao tác với Smart Contract</p>
                  <button 
                    onClick={connectWallet}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Kết nối ngay →
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ví Kết Nối</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-900">{account.slice(0, 10)}...{account.slice(-8)}</p>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số dư ETH</p>
                      <p className="text-lg font-black text-slate-900">
                        {parseFloat(balance).toFixed(3)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cấp Độ Quyền</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentRole === 'owner' && (
                          <span className="text-xs font-black text-indigo-600">OWNER (CHU TRAI)</span>
                        )}
                        {currentRole === 'doctor' && (
                          <span className="text-xs font-black text-emerald-600">DOCTOR (BAC SI)</span>
                        )}
                        {currentRole === 'guest' && (
                          <span className="text-xs font-black text-slate-500">GUEST (KHACH)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      onClick={connectWallet}
                      className="w-full text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Đổi tài khoản ví
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Network Infrastructure Meta */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-[2.5rem] p-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Thông Số Mạng</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LayoutDashboard className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Chain ID</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{chainId?.toString() || '---'}</span>
                </div>
                <div className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-500">Contract</span>
                  </div>
                  <span className="text-xs font-black text-indigo-600">{contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Decal */}
      <footer className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-200 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-xl border border-slate-200">
                <Beef className="w-6 h-6 text-indigo-500" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900">CowChain Protocol</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
              Kiến trúc phi tập trung dành cho việc quản lý và giám sát vật nuôi theo thời gian thực. 
              Mọi thay đổi trạng thái đều được ký số và lưu trữ vĩnh viễn trên sổ cái Blockchain.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="p-2 border border-slate-200 rounded-xl hover:text-indigo-600 transition-colors cursor-pointer"><ArrowRight className="w-4 h-4" /></div>
              <div className="p-2 border border-slate-200 rounded-xl hover:text-indigo-600 transition-colors cursor-pointer"><ExternalLink className="w-4 h-4" /></div>
            </div>
          </div>
          
          <div className="md:col-span-3 space-y-6">
            <h4 className="font-black text-[10px] text-slate-900 uppercase tracking-[0.3em]">Hệ Sinh Thái</h4>
            <ul className="space-y-3 text-sm font-bold">
              <li className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-2 group">
                <div className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors" />
                Smart Registry
              </li>
              <li className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-2 group">
                <div className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors" />
                Asset Tokenization
              </li>
              <li className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-2 group">
                <div className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors" />
                Oracle Integration
              </li>
            </ul>
          </div>
          
          <div className="md:col-span-4 bg-indigo-50 border border-indigo-100 rounded-3xl p-6 relative overflow-hidden">
            <h4 className="font-black text-[10px] text-indigo-600 uppercase tracking-[0.3em] mb-4">Trạng Thái Demo</h4>
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Node Localhost Trực Tuyến
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
              Hệ thống đang hoạt động trên mạng Hardhat cục bộ. Đối với mục đích Demo, 
              dữ liệu được khởi tạo từ cache nếu ví chưa được kết nối.
            </p>
            <ChevronDown className="absolute bottom-4 right-4 w-4 h-4 text-indigo-200" />
          </div>
        </div>
        
        <div className="mt-20 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">© 2026 CowChain Operating System</p>
          <div className="flex items-center gap-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
            <span className="hover:text-indigo-400 cursor-pointer">Privacy Protocol</span>
            <span className="hover:text-indigo-400 cursor-pointer">Smart Documentation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
