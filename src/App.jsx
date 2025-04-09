import React, { useEffect, useRef, useState } from "react";

const TwoHeadedArrow = ({ 
  label = "Timeout interval", 
  length = 800, 
  x = 50, 
  y = 50,
  color = "black"
}) => {
  return (
    <svg width={length + 20} height={100} className="overflow-visible">
      {/* Vertical start line */}
      <line 
        x1={x + 10} 
        y1={y - 20}  
        x2={x + 10} 
        y2={y + 20}  
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Main horizontal arrow */}
      <line 
        x1={x + 10} 
        y1={y} 
        x2={x + length + 10} 
        y2={y} 
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Vertical end line */}
      <line 
        x1={x + length + 10} 
        y1={y - 20} 
        x2={x + length + 10} 
        y2={y + 20} 
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Label */}
      <text 
        x={x + length / 2 + 10} 
        y={y - 10} 
        textAnchor="middle" 
        fontSize="15"
        fill={color}
      >
        {label}
      </text>
    </svg>
  );
};

// Window Component to visualize sliding window
const SlidingWindow = ({ 
  x, 
  y, 
  width, 
  height, 
  label, 
  color = "rgba(0, 128, 255, 0.2)" 
}) => {
  return (
    <g className="window-slide" style={{ transform: `translateX(${x}px)` }}>
      <rect 
        x={0} 
        y={y + 5} 
        width={width} 
        height={height + 30} 
        fill={color} 
        stroke="rgba(0, 128, 255, 0.8)" 
        strokeWidth="2" 
        strokeDasharray="5,5" 
      />
      <text 
        x={width / 2} 
        y={y - 5} 
        textAnchor="middle" 
        fontSize="12" 
        fill="rgba(0, 128, 255, 0.8)"
      >
        {label}
      </text>
    </g>
  );
};

// Timer Component to visualize individual packet timers
const PacketTimer = ({ x, y, progress, isActive }) => {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="white"
        stroke="#ccc"
        strokeWidth="2"
      />
      {isActive && (
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke="orange"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${x} ${y})`}
        />
      )}
    </g>
  );
};

const SelectiveRepeatARQ = () => {
  const senderRefs = useRef([]);
  const receiverRefs = useRef([]);
  const [arrowPositions, setArrowPositions] = useState([]);
  const [ackPositions, setAckPositions] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isContinuous, setIsContinuous] = useState(false);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1); // 1 is default speed
  const stepTimerRef = useRef(null);
  const [lostFrames, setLostFrames] = useState([1]);
  const [lostAcks, setLostAcks] = useState([]);
  const [shownSenderFrames, setShownSenderFrames] = useState([]);
  const [shownReceiverFrames, setShownReceiverFrames] = useState([]);
  const [visibleArrowIndexes, setVisibleArrowIndexes] = useState([]);
  const windowSize = 4;
  const [packetTimers, setPacketTimers] = useState({});
  const [adaptiveTimeout, setAdaptiveTimeout] = useState(600);
  const [windowStart, setWindowStart] = useState(0);
  const [receiverWindowStart, setReceiverWindowStart] = useState(0);
  const [logs, setLogs] = useState([]);
  const prevStepRef = useRef(0);
  const prevWindowStartRef = useRef(0);
  const prevReceiverWindowStartRef = useRef(0);
  const prevShownFramesRef = useRef([]);

  // Function to add a log entry
  const addLog = (message) => {
    setLogs([{ message }]); // Only keep the current message
  };

  // Handle lost frames input
  const handleLostFramesChange = (e) => {
    const input = e.target.value;
    const frames = input.split(',')
      .map(f => parseInt(f.trim()))
      .filter(f => !isNaN(f) && f >= 0 && f <= 3);
    setLostFrames(frames);
    resetSimulation();
  };

  // Handle lost ACKs input
  const handleLostAcksChange = (e) => {
    const input = e.target.value;
    const acks = input.split(',')
      .map(f => parseInt(f.trim()))
      .filter(f => !isNaN(f) && f >= 0 && f <= 3);
    setLostAcks(acks);
    resetSimulation();
  };

  // Update ACK trigger mapping based on lost frames and lost ACKs
  const getAckTriggerMapping = () => {
    const mapping = {
      0: lostFrames.includes(0) || lostAcks.includes(0) ? null : 4,
      1: lostFrames.includes(1) || lostAcks.includes(1) ? null : 5,
      2: lostFrames.includes(2) || lostAcks.includes(2) ? null : 6,
      3: lostFrames.includes(3) || lostAcks.includes(3) ? null : 7,
      4: 8,
      5: 9,
      6: 10,
      7: 11,
      8: 12,
      9: 13,
    };
    
    // Add retransmitted frames' ACKs (including frames whose ACKs were lost)
    [...lostFrames, ...lostAcks].forEach(frame => {
      if (frame >= 0 && frame <= 3) {
        mapping[frame] = frame + 8; // Retransmitted frame's ACK comes later
      }
    });
    
    return mapping;
  };

  // Toggle Continuous Mode
  const toggleMode = () => {
    setSimulationStarted(true);
    setIsContinuous(prev => !prev);
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    if (!isContinuous) {
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prevStep => prevStep + 1);
      }, 2000 / animationSpeed);
    }
  };

  // Handle animation speed change
  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setAnimationSpeed(newSpeed);
    
    // Update continuous mode interval if it's running
    if (isContinuous && stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prevStep => prevStep + 1);
      }, 2000 / newSpeed);
    }
  };

  // Handle manual next step
  const handleNextStep = () => {
    setSimulationStarted(true);
    setCurrentStep(prevStep => prevStep + 1);
  };

  // Handle manual previous step
  const handlePrevStep = () => {
    setCurrentStep(prevStep => {
      const newStep = Math.max(0, prevStep - 1);
      // When going back, we need to recalculate window positions
      const ackMapping = getAckTriggerMapping();
      let newWindowStart = 0;
      let newReceiverStart = 0;
      
      // Find the appropriate window positions for this step
      for (let step = 0; step <= newStep; step++) {
        let lowestUnackedFrame = newWindowStart;
        while (lowestUnackedFrame < newWindowStart + windowSize) {
          const isAcked = Object.keys(ackMapping)
            .filter(frame => parseInt(frame) === lowestUnackedFrame)
            .some(frame => ackMapping[frame] * 2 - 1 <= step);
          
          if (!isAcked) break;
          lowestUnackedFrame++;
        }
        
        const slideAmount = lowestUnackedFrame - newWindowStart;
        if (slideAmount > 0) {
          newWindowStart = lowestUnackedFrame;
          newReceiverStart += slideAmount;
        }
      }
      
      setWindowStart(newWindowStart);
      setReceiverWindowStart(newReceiverStart);
      return newStep;
    });
  };

  // Reset simulation
  const resetSimulation = () => {
    setCurrentStep(0);
    setWindowStart(0);
    setReceiverWindowStart(0);
    setShownSenderFrames([]);
    setShownReceiverFrames([]);
    setVisibleArrowIndexes([]);
    setPacketTimers({});
    setSimulationStarted(false);
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    setIsContinuous(false);
    setLogs([]);
  };

  // Calculate adaptive timeout based on network conditions
  const calculateAdaptiveTimeout = () => {
    // Simulate RTT variation based on current step
    const baseRTT = 500;
    const variation = Math.sin(currentStep * 0.1) * 100;
    
    // Apply exponential backoff after frame loss
    const backoff = shownSenderFrames.includes(lostFrames[0]) ? 
      Math.min(200 * Math.pow(2, Math.min(3, currentStep - lostFrames[0] * 2)), 800) : 0;
    
    const newTimeout = baseRTT + variation + backoff;
    setAdaptiveTimeout(newTimeout);
    
    return newTimeout;
  };

  useEffect(() => {
    // Calculate adaptive timeout
    calculateAdaptiveTimeout();
    
    // Get current ACK trigger mapping based on lostFrames
    const ackTriggerMapping = getAckTriggerMapping();

    // Update window positions based on ACKs
    const updateWindows = () => {
      // Find the lowest unacknowledged frame in the current window
      let lowestUnackedFrame = windowStart;
      while (lowestUnackedFrame < windowStart + windowSize) {
        const isAcked = Object.keys(ackTriggerMapping)
          .filter(frame => parseInt(frame) === lowestUnackedFrame)
          .some(frame => ackTriggerMapping[frame] * 2 - 1 <= currentStep);
        
        if (!isAcked) break;
        lowestUnackedFrame++;
      }
      
      // Calculate how many positions to slide
      const slideAmount = lowestUnackedFrame - windowStart;
      
      if (slideAmount > 0) {
        // Slide both windows by the same amount
        setWindowStart(lowestUnackedFrame);
        setReceiverWindowStart(receiverWindowStart + slideAmount);
      }
    };

    const calculateArrowPositions = () => {
      if (senderRefs.current.length && receiverRefs.current.length) {
        const dataArrows = senderRefs.current
          .map((senderEl, index) => {
            if (!senderEl || !receiverRefs.current[index]) return null;
            const senderBox = senderEl.getBoundingClientRect();
            const receiverBox = receiverRefs.current[index].getBoundingClientRect();

            return {
              x1: senderBox.left + senderBox.width / 2,
              y1: senderBox.top + senderBox.height / 2,
              x2: receiverBox.left + receiverBox.width / 2,
              y2: receiverBox.top + receiverBox.height / 2,
              sender: index,
              isError: lostFrames.includes(index)
            };
          })
          .filter(Boolean);

        setArrowPositions(dataArrows);
        
        const ackArrows = receiverRefs.current
          .map((receiverEl, index) => {
            const ackSenderIndex = ackTriggerMapping[index];
            if (!receiverEl || ackSenderIndex === null || !senderRefs.current[ackSenderIndex]) 
              return null;

            const receiverBox = receiverEl.getBoundingClientRect();
            const senderBox = senderRefs.current[ackSenderIndex].getBoundingClientRect();

            return {
              x1: receiverBox.left + receiverBox.width / 2,
              y1: receiverBox.top + receiverBox.height / 2,
              x2: senderBox.left + senderBox.width / 2,
              y2: senderBox.top + senderBox.height / 2,
              label: `Ack ${index}`,
              ackStep: ackTriggerMapping[index] * 2 - 1,
              isFromError: receiverPackets[index] === "E",
            };
          })
          .filter(Boolean);

        setAckPositions(ackArrows);
      }
    };

    // Call updateWindows before calculating arrow positions
    updateWindows();
    const timer = setTimeout(calculateArrowPositions, 100);

    // Manage frame visibility based on current step
    const newSenderFrames = arrowPositions
      .filter((_, index) => index * 2 <= currentStep)
      .map(arrow => arrow.sender);
    
    const newReceiverFrames = arrowPositions
      .filter((_, index) => index * 2 <= currentStep)
      .map(arrow => arrow.sender);

    // New logic to manage visible arrow indexes
    const newVisibleArrowIndexes = arrowPositions
      .filter((_, index) => newSenderFrames.includes(index))
      .map((_, index) => index);

    setShownSenderFrames(newSenderFrames);
    setShownReceiverFrames(newReceiverFrames);
    setVisibleArrowIndexes(newVisibleArrowIndexes);

    // Update packet timers
    const newPacketTimers = {};
    for (let i = 0; i < 14; i++) {
      // Only active timers for packets in the current window that haven't been ACKed
      const isInWindow = i >= windowStart && i < windowStart + windowSize;
      const isAcked = Object.keys(ackTriggerMapping)
        .filter(frame => parseInt(frame) === i && ackTriggerMapping[frame] !== null)
        .some(frame => ackTriggerMapping[frame] * 2 - 1 <= currentStep);
      
      const isActive = isInWindow && !isAcked && shownSenderFrames.includes(i);
      
      // Calculate progress based on current step and when the packet was sent
      const sentStep = i * 2;
      const timeElapsed = Math.max(0, currentStep - sentStep);
      const timeoutSteps = adaptiveTimeout / 2000; // Convert timeout to steps
      const progress = Math.min(1, timeElapsed / timeoutSteps);
      
      newPacketTimers[i] = { isActive, progress };
    }
    setPacketTimers(newPacketTimers);

    // Update refs for next comparison
    prevStepRef.current = currentStep;
    prevWindowStartRef.current = windowStart;
    prevReceiverWindowStartRef.current = receiverWindowStart;
    prevShownFramesRef.current = [...shownSenderFrames];

    if (isContinuous) {
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prevStep => prevStep + 1);
      }, 2000 / animationSpeed);
    }

    return () => {
      clearTimeout(timer);
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
      }
    };
  }, [isContinuous, currentStep, adaptiveTimeout, windowStart, lostFrames, lostAcks, animationSpeed]);

  // Create packet sequences based on lost frames and lost ACKs
  const createSenderPackets = () => {
    let initial = 8;
    let packets = [...Array(initial).keys()]; // Basic sequence 0-7
    
    // Add retransmitted frames in order (including frames whose ACKs were lost)
    [...new Set([...lostFrames, ...lostAcks])].forEach(frame => {
      if (frame >= 0 && frame <= 3) {
        packets.push(frame); // Add retransmitted frame
      }
    });
    
    // Add additional frames after retransmissions
    for (let i = 8; i < 14; i++) {
      packets.push(i);
    }
    
    return packets;
  };
  
  const createReceiverPackets = () => {
    let packets = [];
    
    // Create the sequence with errors at lost frame positions
    for (let i = 0; i < 8; i++) {
      packets.push(lostFrames.includes(i) ? "E" : i);
    }
    
    // Add the retransmitted frames in order (including frames whose ACKs were lost)
    [...new Set([...lostFrames, ...lostAcks])].forEach(frame => {
      if (frame >= 0 && frame <= 3) {
        packets.push(frame);
      }
    });
    
    // Add remaining frames
    for (let i = 8; i < 13; i++) {
      packets.push(i);
    }
    
    return packets;
  };
  
  const senderPackets = createSenderPackets();
  const receiverPackets = createReceiverPackets();
  
  // Calculate arrow positioning based on lost frame
  const getArrowPosition = (frameType) => {
    const baseOffset = 300;
    const lostFrameOffset = lostFrames[0] * 90;
    
    if (frameType === 'timeout') {
      return {
        x: baseOffset + lostFrameOffset,
        y: 30
      };
    } else if (frameType === 'buffer') {
      return {
        x: baseOffset + 300 + lostFrameOffset,
        y: 350
      };
    } else if (frameType === 'error') {
      return {
        x: baseOffset + 200 + lostFrameOffset,
        y: 340
      };
    } else if (frameType === 'network') {
      return {
        x: baseOffset + 800 + lostFrameOffset,
        y: 340
      };
    }
    
    return { x: 0, y: 0 };
  };
  
  const timeoutArrowPos = getArrowPosition('timeout');
  const bufferArrowPos = getArrowPosition('buffer');
  const errorArrowPos = getArrowPosition('error');
  const networkArrowPos = getArrowPosition('network');
  
  return (
    <div className="relative flex flex-col items-center p-5">
      <h1 className="text-4xl font-bold mb-4">Selective Repeat ARQ</h1>
      
      {/* Control Panel */}
      <div className="flex items-center space-x-4 m-4 text-xl">
        <div className="flex items-center space-x-2">
          <label htmlFor="mode-toggle">Continuous</label>
          <input 
            type="checkbox" 
            id="mode-toggle" 
            checked={isContinuous} 
            onChange={toggleMode} 
            className="toggle"
          />
        </div>

        {/* Animation Speed Control */}
        <div className="flex items-center space-x-2">
          <label htmlFor="speed-control">Speed:</label>
          <input
            type="range"
            id="speed-control"
            min="0.5"
            max="3"
            step="0.5"
            value={animationSpeed}
            onChange={handleSpeedChange}
            className="w-32"
          />
          <span className="text-sm">{animationSpeed}x</span>
        </div>
        
        {/* Lost Frames Input */}
        <div className="flex items-center space-x-2">
          <label htmlFor="lost-frames-input">Lost Frames (0-3):</label>
          <input 
            type="text" 
            id="lost-frames-input" 
            defaultValue={lostFrames.join(',')} 
            onChange={handleLostFramesChange}
            placeholder="e.g. 0,1,2"
            className={`px-3 py-2 border rounded w-32 ${simulationStarted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            disabled={simulationStarted}
          />
        </div>

        {/* Lost ACKs Input */}
        <div className="flex items-center space-x-2">
          <label htmlFor="lost-acks-input">Lost ACKs (0-3):</label>
          <input 
            type="text" 
            id="lost-acks-input" 
            defaultValue={lostAcks.join(',')} 
            onChange={handleLostAcksChange}
            placeholder="e.g. 0,1,2"
            className={`px-3 py-2 border rounded w-32 ${simulationStarted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            disabled={simulationStarted}
          />
        </div>
        
        {!isContinuous && (
          <>
            <button 
              onClick={handlePrevStep}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous Step
            </button>
            <button 
              onClick={handleNextStep} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Next Step
            </button>
          </>
        )}
        <button 
          onClick={resetSimulation} 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>

      {!simulationStarted && (
        <div className="text-center mb-4 text-lg text-blue-600">
          Please enter lost frames and lost ACKs before starting the simulation
        </div>
      )}

      <style>{`
        @keyframes drawArrow {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes blinkError {
          0%, 100% { stroke: red; }
          50% { stroke: #ff8080; }
        }
        
        .data-arrow, .ack-arrow {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawArrow ${1/animationSpeed}s linear forwards;
        }
        
        .error-arrow {
          animation: drawArrow ${1/animationSpeed}s linear forwards, blinkError ${1/animationSpeed}s infinite;
        }
        
        .frame-fade-in {
          animation: fadeIn ${0.5/animationSpeed}s ease-out forwards;
        }
        
        .window-slide {
          transition: transform ${0.5/animationSpeed}s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
        }
      `}</style>

      {/* Sender Packets */}
      <div className="flex space-x-2 mt-10">
        {senderPackets.map((num, index) => (
          <div 
            key={index} 
            ref={el => senderRefs.current[index] = el} 
            className={`w-15 h-15 m-4 border border-black flex items-center justify-center 
              ${shownSenderFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}
              ${index >= windowStart && index < windowStart + windowSize ? 'border-blue-500 border-2' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Receiver Packets */}
      <div className="flex space-x-2 mt-20 ml-15">
        {receiverPackets.map((num, index) => (
          <div 
            key={index} 
            ref={el => receiverRefs.current[index] = el} 
            className={`w-15 h-15 m-4 mt-10 border border-black flex items-center justify-center 
              ${shownReceiverFrames.includes(index) ? 'frame-fade-in' : 'opacity-0'}
              ${index >= receiverWindowStart && index < receiverWindowStart + windowSize ? 'border-green-500 border-2' : ''}`}
          >
            {num}
          </div>
        ))}
      </div>

      {/* Arrows using SVG */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* Sliding Windows */}
        {senderRefs.current.length > 0 && (
          <SlidingWindow 
            x={senderRefs.current[windowStart]?.getBoundingClientRect().left - 10 || 0}
            y={senderRefs.current[0]?.getBoundingClientRect().top - 10 || 0}
            width={Math.min(windowSize, senderRefs.current.length - windowStart) * 
              (senderRefs.current[1]?.getBoundingClientRect().left - senderRefs.current[0]?.getBoundingClientRect().left || 60)}
            height={40}
            label="Sender Window"
            color="rgba(0, 128, 255, 0.2)"
          />
        )}
        
        {receiverRefs.current.length > 0 && (
          <SlidingWindow 
            x={receiverRefs.current[receiverWindowStart]?.getBoundingClientRect().left - 10 || 0}
            y={receiverRefs.current[0]?.getBoundingClientRect().top - 10 || 0}
            width={Math.min(windowSize, receiverRefs.current.length - receiverWindowStart) * 
              (receiverRefs.current[1]?.getBoundingClientRect().left - receiverRefs.current[0]?.getBoundingClientRect().left || 60)}
            height={40}
            label="Receiver Window"
            color="rgba(0, 192, 0, 0.2)"
          />
        )}

        {/* Packet Timers */}
        {Object.entries(packetTimers).map(([index, { isActive, progress }]) => {
          const packetEl = senderRefs.current[parseInt(index)];
          if (!packetEl || !shownSenderFrames.includes(parseInt(index))) return null;
          
          const rect = packetEl.getBoundingClientRect();
          return (
            <PacketTimer 
              key={`timer-${index}`}
              x={rect.left + rect.width / 2}
              y={rect.top - 15}
              progress={progress}
              isActive={isActive}
            />
          );
        })}
        
        {/* ACK Arrows - drawn before data arrows */}
        {ackPositions
          .filter(({ ackStep }) => ackStep <= currentStep)
          .map(({ x1, y1, x2, y2, label, isFromError }, index) => {
            const ackNumber = parseInt(label.split(' ')[1]);
            const isLostAck = lostAcks.includes(ackNumber);
            
            // Don't show lost ACKs at all
            if (isLostAck) return null;
            
            return (
              <React.Fragment key={`ack-${index}`}>
                <line 
                  x1={x1} y1={y1 - 30} 
                  x2={x2} y2={y2 + 30} 
                  stroke={isFromError ? "white" : "grey"} 
                  strokeWidth="2" 
                  opacity="0.8" 
                  className="ack-arrow" 
                />
                <text 
                  x={(x1 + x2) / 2} 
                  y={(y1 + y2) / 2 - 5} 
                  fontSize="15" 
                  fill={isFromError ? "white" : "grey"} 
                  fontWeight="bold"
                  textAnchor="middle" 
                  dominantBaseline="middle"
                >
                  {label}
                </text>
              </React.Fragment>
            );
          })}

        {/* Data Arrows - Modified for lost frames */}
        {arrowPositions
          .filter((_, index) => visibleArrowIndexes.includes(index))
          .map(({ x1, y1, x2, y2, sender, isError }, index) => (
            <line 
              key={`data-${sender}`} 
              x1={x1} y1={y1 + 30} 
              x2={x2} y2={y2 - 30} 
              stroke={lostFrames.includes(sender) ? "red" : "black"} 
              strokeWidth="2" 
              className={lostFrames.includes(sender) ? "error-arrow" : "data-arrow"}
            />
          ))}
      </svg>
    </div>
  );
};

export default SelectiveRepeatARQ;