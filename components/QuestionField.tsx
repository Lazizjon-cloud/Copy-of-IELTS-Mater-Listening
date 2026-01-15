
import React, { useState, useEffect } from 'react';
import { Question } from '../types';

interface QuestionFieldProps {
  question: Question;
  value: string;
  onChange: (id: number, val: string) => void;
  onAssistanceUsed?: (id: number, type: 'lifeline' | 'script') => void;
  isSubmitted: boolean;
  isCorrect: boolean;
  presentationMode: boolean;
  showSectionHeader?: boolean;
}

const QuestionField: React.FC<QuestionFieldProps> = ({ 
  question, 
  value, 
  onChange, 
  onAssistanceUsed,
  isSubmitted, 
  isCorrect,
  presentationMode,
  showSectionHeader = true
}) => {
  const [showProofText, setShowProofText] = useState(false);
  const [isLifelineActive, setIsLifelineActive] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<string[]>([]);

  const handleToggleProof = () => {
    const newState = !showProofText;
    setShowProofText(newState);
    // Only record assistance if the test is NOT submitted
    if (newState && onAssistanceUsed && !isSubmitted) {
      onAssistanceUsed(question.id, 'script');
    }
  };

  const handleToggleLifeline = () => {
    if (isSubmitted) return;
    const newState = !isLifelineActive;
    setIsLifelineActive(newState);
    if (newState && onAssistanceUsed) {
      onAssistanceUsed(question.id, 'lifeline');
    }
  };

  useEffect(() => {
    if (isLifelineActive && question.type === 'MCQ' && question.options) {
      const correctOption = question.answer;
      const wrongOptions = question.options.filter(opt => opt !== correctOption);
      const toHide = [...wrongOptions]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.max(0, question.options.length - 2));
      setHiddenOptions(toHide);
    } else {
      setHiddenOptions([]);
    }
  }, [isLifelineActive, question]);

  const renderMCQ = () => {
    const gridCols = presentationMode ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2';
    return (
      <div className={`grid gap-4 ${presentationMode ? 'gap-8 mt-10' : 'mt-4'} ${gridCols}`}>
        {question.options?.map((option) => {
          const isSelected = value === option;
          const isAnswer = option === question.answer;
          const isHidden = hiddenOptions.includes(option);
          const displayLetter = option.charAt(0);
          const labelText = option.includes(')') ? option.split(')')[1].trim() : option;

          if (isHidden && !isSubmitted) return null;

          let buttonClass = "bg-white text-black border-gray-400 hover:border-[#003366] hover:text-[#003366]";
          let badgeClass = "bg-gray-100 text-gray-600 border-gray-200";

          if (isSubmitted) {
            if (isSelected && isCorrect) {
              buttonClass = "bg-green-600 text-white border-green-600 shadow-md";
              badgeClass = "bg-white text-green-600 border-white";
            } else if (isSelected && !isCorrect) {
              buttonClass = "bg-red-600 text-white border-red-600 shadow-md";
              badgeClass = "bg-white text-red-600 border-white";
            } else if (!isSelected && isAnswer) {
              buttonClass = "bg-white text-green-700 border-green-500 ring-4 ring-green-100";
              badgeClass = "bg-green-600 text-white border-green-600";
            }
            if (isHidden) buttonClass += " opacity-20 grayscale";
          } else if (isSelected) {
            buttonClass = "bg-[#003366] text-white border-[#003366] shadow-xl scale-[1.02]";
            badgeClass = "bg-white text-[#003366] border-white";
          }

          return (
            <button
              key={option}
              disabled={isSubmitted}
              onClick={() => onChange(question.id, option)}
              className={`border-2 rounded-2xl font-black transition-all text-left flex items-center whitespace-normal ${presentationMode ? 'px-10 py-8 text-4xl' : 'px-4 py-4 text-base'} ${buttonClass}`}
            >
              <div className={`flex-shrink-0 rounded-xl border flex items-center justify-center mr-6 font-black ${presentationMode ? 'w-20 h-20 text-4xl' : 'w-10 h-10 text-sm'} ${badgeClass}`}>
                {displayLetter}
              </div>
              <span className="flex-1 leading-tight break-words">{labelText}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const isGapStyle = question.type === 'SENTENCE' || question.type === 'NOTE';
  const isNote = question.type === 'NOTE';
  const labelSize = presentationMode ? 'text-5xl' : 'text-xl';
  const textSize = presentationMode ? 'text-4xl' : 'text-lg';

  return (
    <div className={`transition-all duration-300 bg-white rounded-3xl ${presentationMode ? 'py-16 px-10 mb-10 border-2 border-gray-100 shadow-lg' : 'py-6 px-4 border-b border-gray-100'}`}>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1">
          {question.label && showSectionHeader && (
            <h4 className={`font-black text-black leading-tight mb-6 ${labelSize} ${isNote ? 'border-b-4 border-gray-50 pb-4' : ''}`}>
              {question.label}
            </h4>
          )}

          {isGapStyle ? (
            <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-4 leading-[1.6] text-black font-medium ${textSize}`}>
              {isNote && <span className="text-gray-300 mr-2">•</span>}
              
              {question.prefix && <span className="whitespace-normal">{question.prefix}</span>}
              
              <div className="inline-flex items-center gap-2 group">
                <span className="font-black text-[#003366] min-w-[30px]">{question.id}</span>
                <div className="relative inline-block min-w-[150px] max-w-[400px]">
                  <input
                    type="text"
                    value={value}
                    disabled={isSubmitted}
                    onChange={(e) => onChange(question.id, e.target.value)}
                    className={`w-full bg-transparent border-b-2 border-dashed border-gray-400 outline-none transition-all font-black text-center pb-0.5 px-2 ${presentationMode ? 'text-5xl' : 'text-xl'} ${isSubmitted ? (isCorrect ? 'text-green-600 border-green-500' : 'text-red-600 border-red-500') : 'focus:border-[#003366] text-black'}`}
                    placeholder="...................."
                    autoComplete="off"
                  />
                </div>
              </div>

              {question.suffix && <span className="whitespace-normal">{question.suffix}</span>}
              
              {isSubmitted && !isCorrect && (
                <span className={`font-black text-green-600 italic ml-2 border-l-2 border-green-100 pl-3 ${presentationMode ? 'text-3xl' : 'text-sm'}`}>
                  (Ans: {question.answer})
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4 mb-4">
                <span className={`font-black text-black shrink-0 ${labelSize}`}>{question.id}. {question.label}</span>
              </div>
              <div className="w-full">{renderMCQ()}</div>
            </>
          )}
        </div>

        <div className="flex flex-row sm:flex-col gap-3 flex-shrink-0 self-start sm:self-center">
          <button 
            onClick={handleToggleProof}
            className={`rounded-2xl transition-all active:scale-95 shadow-sm flex items-center justify-center ${presentationMode ? 'p-10' : 'p-3'} ${showProofText ? 'bg-[#003366] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
            title="Toggle Script Highlight"
          >
            <svg className={presentationMode ? 'w-12 h-12' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          {question.type === 'MCQ' && (
            <button 
              onClick={handleToggleLifeline}
              disabled={isSubmitted}
              className={`rounded-2xl transition-all active:scale-95 shadow-sm flex items-center justify-center ${presentationMode ? 'p-10' : 'p-3'} ${isLifelineActive ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'} ${isSubmitted ? 'opacity-30 cursor-not-allowed' : ''}`}
              title="50/50 Lifeline"
            >
              <span className={`font-black uppercase tracking-tighter ${presentationMode ? 'text-2xl' : 'text-[10px]'}`}>50/50</span>
            </button>
          )}
        </div>
      </div>

      {showProofText && (
        <div className={`mt-10 p-10 bg-blue-50/50 border-l-[12px] border-[#003366] rounded-r-2xl animate-in fade-in slide-in-from-top-4 duration-500 shadow-inner`}>
          <span className={`font-black text-[#003366] uppercase block mb-4 tracking-widest ${presentationMode ? 'text-xl' : 'text-[10px]'}`}>Transcription Proof</span>
          <p className={`text-[#003366] font-bold italic leading-relaxed ${presentationMode ? 'text-4xl' : 'text-lg'}`}>"{question.answerSentence}"</p>
        </div>
      )}
    </div>
  );
};

export default QuestionField;
