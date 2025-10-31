"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Skill {
  name: string;
  proficiency?: "beginner" | "intermediate" | "expert";
}

interface SkillTagInputProps {
  value: Skill[];
  onChange: (skills: Skill[]) => void;
  placeholder?: string;
  showProficiency?: boolean;
  className?: string;
}

export default function SkillTagInput({
  value,
  onChange,
  placeholder,
  showProficiency = false,
  className,
}: SkillTagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeSkill(value.length - 1);
    }
  };

  const addSkill = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.some(s => s.name === trimmed)) {
      onChange([...value, { name: trimmed, proficiency: showProficiency ? "intermediate" : undefined }]);
      setInputValue("");
    }
  };

  const removeSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateProficiency = (index: number, proficiency: "beginner" | "intermediate" | "expert") => {
    const updated = [...value];
    updated[index] = { ...updated[index], proficiency };
    onChange(updated);
  };

  const getProficiencyColor = (proficiency?: string) => {
    switch (proficiency) {
      case "expert": return "bg-green-100 text-green-800 hover:bg-green-100";
      case "intermediate": return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "beginner": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      default: return "";
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((skill, index) => (
          <div key={index} className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className={`pl-2 pr-1 py-1 flex items-center gap-1 ${showProficiency && skill.proficiency ? getProficiencyColor(skill.proficiency) : ""}`}
            >
              {skill.name}
              {showProficiency && skill.proficiency && (
                <span className="text-xs ml-1">
                  ({skill.proficiency === "beginner" ? "Beginner" : skill.proficiency === "intermediate" ? "Intermediate" : "Expert"})
                </span>
              )}
              <button
                type="button"
                onClick={() => removeSkill(index)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
            {showProficiency && (
              <Select
                value={skill.proficiency || "intermediate"}
                onValueChange={(v) => updateProficiency(index, v as "beginner" | "intermediate" | "expert")}
              >
                <SelectTrigger className="w-[110px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addSkill}
        placeholder={placeholder}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Press Enter or comma to add, Backspace to remove
      </p>
    </div>
  );
}
