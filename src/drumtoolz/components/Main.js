import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Share2, Save, Settings, User, Search, BookOpen, Play, Wand2 } from 'lucide-react';

const App = () => {
  const [currentFeature, setCurrentFeature] = useState(0);
  
  const aboutRef = useRef(null);
  const featuresRef = useRef(null);
  const videosRef = useRef(null);
  const faqRef = useRef(null);
  const contactRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      title: "INPUT",
      description: "Create and input your own rhythm patterns. Practice from basic to advanced sequences.",
      icon: <BookOpen className="w-6 h-6" />
    },
    {
      title: "SAVE",
      description: "Store your favorite patterns for future practice sessions.",
      icon: <Save className="w-6 h-6" />
    },
    {
      title: "SHARE",
      description: "Connect with other drummers and share your practice materials.",
      icon: <Share2 className="w-6 h-6" />
    },
    {
      title: "GENERATE",
      description: "Create new practice patterns with various modification options.",
      icon: <Wand2 className="w-6 h-6" />
    }
  ];

  return (
    <>
    <script></script>
    <div className="min-h-screen bg-white">
      <nav className="bg-black text-white p-4 fixed w-full z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-xl font-bold">DrumPractice</div>
          <div className="space-x-6">
            {[
              { name: 'ABOUT', ref: aboutRef },
              { name: 'FEATURES', ref: featuresRef },
              { name: 'VIDEOS', ref: videosRef },
              { name: 'FAQ', ref: faqRef },
              { name: 'CONTACT', ref: contactRef }
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => scrollToSection(item.ref)}
                className="hover:text-gray-300"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section ref={aboutRef} className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Toolz for Drum Mastery</h1>
            <p className="text-xl text-gray-600">Master your rhythm with our comprehensive practice tools</p>
          </div>
        </section>

        <section ref={featuresRef} className="min-h-screen py-16">
          <div className="relative max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentFeature((prev) => (prev > 0 ? prev - 1 : features.length - 1))}
                className="p-2 rounded-full hover:bg-gray-200"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="max-w-lg mx-auto text-center">
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
                    {features[currentFeature].icon}
                  </div>
                  <h2 className="text-2xl font-bold mb-4">{features[currentFeature].title}</h2>
                  <p className="text-gray-600">{features[currentFeature].description}</p>
                </div>
                
                <div className="aspect-w-9 aspect-h-16 bg-gray-100 rounded-lg p-4">
                  <div className="mockup-phone-screen bg-white rounded-lg shadow-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <User className="w-6 h-6" />
                      <Settings className="w-6 h-6" />
                    </div>
                    <div className="h-48 bg-gray-50 rounded flex items-center justify-center">
                      <Play className="w-12 h-12 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setCurrentFeature((prev) => (prev < features.length - 1 ? prev + 1 : 0))}
                className="p-2 rounded-full hover:bg-gray-200"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </section>

        <section ref={videosRef} className="min-h-screen bg-gray-50 py-16">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8 text-center">VIDEOS</h2>
            <div className="space-y-8">
              {[1, 2, 3].map((video) => (
                <div key={video} className="bg-black aspect-video rounded-lg flex items-center justify-center">
                  <Play className="w-16 h-16 text-white opacity-50" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section ref={faqRef} className="min-h-screen py-16">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-12 text-center">FREQUENTLY ASKED QUESTIONS</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold mb-2">DO I NEED TO KNOW HOW TO READ MUSIC?</h3>
                <p className="text-gray-600">Basic music reading skills are recommended for the best experience.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">HOW MUCH DOES IT COST?</h3>
                <p className="text-gray-600">Its free!</p>
              </div>
            </div>
          </div>
        </section>

        <section ref={contactRef} className="min-h-screen bg-gray-50 py-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-8">CONTACT</h2>
            <p className="text-gray-600">drumtoolz.app@gmail.com</p>
          </div>
        </section>
      </main>
    </div>
    </>
  );
};

export default App;