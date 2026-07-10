using System;
using System.Speech.Synthesis;
using System.IO;

class Program {
  static void Main() {
    var path = @"C:\Users\Admin\Projects\codeX\public\welcome-codex.wav";
    using (var synth = new SpeechSynthesizer()) {
      synth.Rate = -3;
      synth.Volume = 100;
      try { synth.SelectVoice("Microsoft David Desktop"); } catch {}
      synth.SetOutputToWaveFile(path);
      synth.Speak("Welcome to Codex");
      synth.SetOutputToNull();
    }
    Console.WriteLine(new FileInfo(path).Length);
  }
}
