import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, ActivityIndicator, Animated, Easing
} from "react-native";
import {
  RTCPeerConnection, mediaDevices, RTCSessionDescription
} from "react-native-webrtc";

const ammaPhoto = require("./assets/amma-photo.png");
const API_BASE_URL = "https://YOUR_SERVER_HOST"; // Replace with your deployed HTTPS backend URL.

const MOTHERLY_TAMIL = "நீங்கள் Amma AI. நீங்கள் ஒரு அன்பான, பொறுமையான, மென்மையான குரலில் பேசும் தமிழ் அம்மா போன்ற AI உதவியாளர். இயல்பான சென்னைத் தமிழில் மட்டும் பேசுங்கள். பயனர் தமிழில் பேசினால் தமிழிலேயே பதில் சொல்லுங்கள். சுருக்கமாகவும் அன்பாகவும் பேசுங்கள்; செயற்கையாக மிகைப்படுத்த வேண்டாம். நீங்கள் உண்மையான மனிதர் அல்லது பயனரின் உயிரியல் தாய் என்று கூறாதீர்கள். நீங்கள் AI உதவியாளர் என்பதைத் தேவையானபோது தெளிவுபடுத்துங்கள். மருத்துவம், சட்டம், பணம் போன்ற முக்கிய விஷயங்களில் நிபுணர் ஆலோசனைக்கு மாற்றாக நடிக்காதீர்கள்.";

export default function App() {
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const [status, setStatus] = useState("தயார்");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [events, setEvents] = useState([]);
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const soundPulse = useRef(new Animated.Value(0.35)).current;

  // UI-only animation: gentle pulse while speaking; no true mouth lip-sync.
  useEffect(() => {
    let loop;
    if (speaking) {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(avatarPulse, { toValue: 1.018, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(avatarPulse, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ]));
      loop.start();
      Animated.timing(soundPulse, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      avatarPulse.stopAnimation();
      Animated.spring(avatarPulse, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
      Animated.timing(soundPulse, { toValue: connected ? 0.55 : 0.25, duration: 350, useNativeDriver: true }).start();
    }
    return () => { if (loop) loop.stop(); };
  }, [speaking, connected]);

  useEffect(() => () => disconnect(false), []);

  function addEvent(text) {
    setEvents(prev => [...prev.slice(-19), { id: Date.now().toString() + Math.random(), text }]);
  }

  async function startCall() {
    if (connected || connecting) return;
    setConnecting(true);
    setStatus("இணைக்கப்படுகிறது...");
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.addEventListener("track", () => {
        // react-native-webrtc routes the remote audio track through the device audio output.
      });

      pc.addEventListener("connectionstatechange", () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setConnected(true);
          setConnecting(false);
          setStatus("அம்மா கேட்கிறார்");
        } else if (state === "failed" || state === "disconnected" || state === "closed") {
          setConnected(false);
          setSpeaking(false);
          if (state !== "closed") setStatus("இணைப்பு துண்டிக்கப்பட்டது");
        }
      });

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      dc.addEventListener("open", () => {
        setStatus("அம்மா கேட்கிறார்");
        // Set the session's Tamil personality and turn-taking behavior.
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: MOTHERLY_TAMIL,
            audio: {
              input: {
                turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true }
              },
              output: { voice: "marin" }
            }
          }
        }));
        addEvent("இணைப்பு வெற்றிகரமாகத் தொடங்கியது.");
      });
      dc.addEventListener("message", e => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "response.audio.delta") setSpeaking(true);
          if (event.type === "response.audio.done" || event.type === "response.done") setSpeaking(false);
          if (event.type === "input_audio_buffer.speech_started") {
            setSpeaking(false);
            setStatus("நீங்கள் பேசுகிறீர்கள்");
          }
          if (event.type === "input_audio_buffer.speech_stopped") setStatus("அம்மா யோசிக்கிறார்...");
          if (event.type === "response.output_audio_transcript.done" && event.transcript) {
            addEvent("அம்மா: " + event.transcript);
            setStatus("அம்மா கேட்கிறார்");
          }
          if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
            addEvent("நீங்கள்: " + event.transcript);
          }
          if (event.type === "error") {
            addEvent("பிழை: " + (event.error?.message || "Realtime error"));
            setStatus("சேவைப் பிழை");
          }
        } catch (_) {}
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("WebRTC SDP offer உருவாக்க முடியவில்லை.");

      const response = await fetch(`${API_BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });
      const answerSdp = await response.text();
      if (!response.ok) throw new Error(answerSdp || `Session error ${response.status}`);

      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
      setStatus("அம்மா கேட்கிறார்");
    } catch (error) {
      console.error(error);
      setStatus("இணைக்க முடியவில்லை");
      Alert.alert("Amma AI connection", error?.message || "சேவையக URL, இணையம், microphone permission ஆகியவற்றைச் சரிபார்க்கவும்.");
      await disconnect(false);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect(updateStatus = true) {
    try { dataChannelRef.current?.close(); } catch (_) {}
    dataChannelRef.current = null;
    try { pcRef.current?.close(); } catch (_) {}
    pcRef.current = null;
    localStreamRef.current?.getTracks?.().forEach(track => track.stop());
    localStreamRef.current = null;
    setConnected(false);
    setConnecting(false);
    setSpeaking(false);
    if (updateStatus) setStatus("அழைப்பு முடிந்தது");
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.brand}>அம்மா AI</Text>
          <Text style={s.sub}>Live Chennai Tamil Conversation</Text>
        </View>
        <View style={s.pill}><View style={[s.dot, { backgroundColor: connected ? "#9AF0B4" : "#F8D27A" }]}/><Text style={s.pillText}>{connected ? "LIVE" : "OFFLINE"}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.avatarCard}>
          <Animated.View style={[s.avatarMotion, { transform: [{ scale: avatarPulse }] }]}>
            <Image source={ammaPhoto} style={s.avatar}/>
          </Animated.View>
          <View style={s.nameTag}><Text style={s.nameText}>அம்மா ❤️</Text></View>
          {(speaking || connected) && <View style={s.voiceTag}><Text style={s.voiceText}>{speaking ? "● அம்மா பேசுகிறார்" : "● அம்மா கேட்கிறார்"}</Text></View>}
          {connected && <View style={s.waveWrap}>
            {[0,1,2,3,4,5,6].map(v => <Animated.View key={v} style={[s.waveBar, { opacity: soundPulse, transform: [{ scaleY: speaking ? (v % 2 ? 1.7 : 1.25) : 0.65 }] }]}/>)}
          </View>}
        </View>

        <View style={s.statusCard}>
          <Text style={s.statusTitle}>{connected ? "என்ன கண்ணா, பேசலாமா?" : "அம்மாவுடன் பேசத் தயாரா?"}</Text>
          <Text style={s.statusDesc}>{connected ? "இயல்பாகத் தமிழில் பேசுங்கள். இடையில் நிறுத்தியும் பேசலாம்." : "Start Live Conversation அழுத்தி microphone அனுமதி கொடுங்கள்."}</Text>
          {connecting ? (
            <View style={s.connecting}><ActivityIndicator color="#FFF"/><Text style={s.callText}>இணைக்கப்படுகிறது...</Text></View>
          ) : connected ? (
            <TouchableOpacity style={s.endButton} onPress={() => disconnect(true)}><Text style={s.callText}>■ அழைப்பை முடி</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.callButton} onPress={startCall}><Text style={s.callText}>☎ Live Conversation தொடங்கு</Text></TouchableOpacity>
          )}
          <Text style={s.connectionText}>{status}</Text>
        </View>

        <Text style={s.section}>உரையாடல் குறிப்புகள்</Text>
        {events.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyText}>உங்கள் உரையாடலின் transcript இங்கே தோன்றும் (Realtime சேவை வழங்கினால்).</Text></View>
        ) : events.map(item => <View key={item.id} style={s.event}><Text style={s.eventText}>{item.text}</Text></View>)}

        <View style={s.privacy}>
          <Text style={s.privacyTitle}>தனியுரிமை</Text>
          <Text style={s.privacyText}>Microphone audio live AI சேவைக்கு அனுப்பப்படும். அழைப்பை முடித்தவுடன் microphone track நிறுத்தப்படும். அம்மாவின் புகைப்படம் app-ல் உள்ள local asset ஆகவே வைக்கப்பட்டுள்ளது. API key app-ல் வைக்கப்படாது.</Text>
        </View>
      </ScrollView>
      <Text style={s.footer}>Amma AI V5 • Animated avatar prototype • AI-generated voice, not your mother's recorded voice</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF8F1"},
  header:{paddingHorizontal:20,paddingVertical:15,backgroundColor:"#713747",flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  brand:{fontSize:25,fontWeight:"800",color:"#FFF"},sub:{fontSize:11,color:"#F7DCE2",marginTop:3},
  pill:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF22",paddingHorizontal:10,paddingVertical:8,borderRadius:20},
  dot:{width:8,height:8,borderRadius:4,marginRight:6},pillText:{fontSize:11,color:"#FFF",fontWeight:"800"},
  body:{padding:16,paddingBottom:28},
  avatarCard:{height:350,borderRadius:24,overflow:"hidden",backgroundColor:"#EAD8D0",marginBottom:15},
  avatarMotion:{width:"100%",height:"100%"},
  avatar:{width:"100%",height:"100%",resizeMode:"cover"},
  waveWrap:{position:"absolute",bottom:18,right:16,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#713747D9",paddingHorizontal:12,paddingVertical:9,borderRadius:18},
  waveBar:{width:4,height:13,borderRadius:3,backgroundColor:"#FFF"},
  nameTag:{position:"absolute",bottom:12,left:12,backgroundColor:"#713747E8",paddingHorizontal:14,paddingVertical:8,borderRadius:18},
  nameText:{color:"#FFF",fontWeight:"800"},
  voiceTag:{position:"absolute",top:12,left:12,backgroundColor:"#713747E8",paddingHorizontal:12,paddingVertical:8,borderRadius:18},
  voiceText:{color:"#FFF",fontSize:11,fontWeight:"700"},
  statusCard:{backgroundColor:"#FCE9E8",padding:17,borderRadius:20},
  statusTitle:{fontSize:20,fontWeight:"800",color:"#713747"},statusDesc:{fontSize:13,color:"#684D50",lineHeight:21,marginTop:6,marginBottom:14},
  callButton:{backgroundColor:"#713747",padding:15,borderRadius:28,alignItems:"center"},
  endButton:{backgroundColor:"#9B3E4A",padding:15,borderRadius:28,alignItems:"center"},
  connecting:{backgroundColor:"#713747",padding:15,borderRadius:28,alignItems:"center",flexDirection:"row",justifyContent:"center",gap:9},
  callText:{color:"#FFF",fontSize:14,fontWeight:"800"},connectionText:{fontSize:11,color:"#80656A",textAlign:"center",marginTop:10},
  section:{fontSize:17,fontWeight:"800",color:"#59313B",marginTop:20,marginBottom:10},
  empty:{backgroundColor:"#FFF",borderRadius:14,padding:15,borderWidth:1,borderColor:"#F0E3DC"},emptyText:{fontSize:12,color:"#897B7B",lineHeight:19},
  event:{backgroundColor:"#FFF",borderRadius:13,padding:12,marginBottom:8,borderWidth:1,borderColor:"#F1E4DF"},eventText:{fontSize:13,color:"#46383A",lineHeight:20},
  privacy:{backgroundColor:"#FFF",borderRadius:15,padding:14,marginTop:18,borderWidth:1,borderColor:"#F0E3DC"},
  privacyTitle:{fontSize:13,fontWeight:"800",color:"#713747",marginBottom:5},privacyText:{fontSize:11,color:"#76676A",lineHeight:18},
  footer:{textAlign:"center",fontSize:9,color:"#9A8D83",padding:8,backgroundColor:"#FFF"}
});
