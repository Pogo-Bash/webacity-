#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <vector>
#include <cmath>
#include <algorithm>

using namespace emscripten;

class AudioProcessor {
private:
    std::vector<float> buffer;
    int sampleRate;
    int channels;

public:
    AudioProcessor() : sampleRate(44100), channels(2) {}

    void setSampleRate(int rate) {
        sampleRate = rate;
    }

    void setChannels(int ch) {
        channels = ch;
    }

    // Amplify audio by a given factor
    std::vector<float> amplify(const std::vector<float>& input, float factor) {
        std::vector<float> output(input.size());
        for (size_t i = 0; i < input.size(); i++) {
            output[i] = std::clamp(input[i] * factor, -1.0f, 1.0f);
        }
        return output;
    }

    // Normalize audio to peak level
    std::vector<float> normalize(const std::vector<float>& input, float targetPeak = 1.0f) {
        // Find peak
        float peak = 0.0f;
        for (float sample : input) {
            peak = std::max(peak, std::abs(sample));
        }

        // Avoid division by zero
        if (peak < 0.0001f) {
            return input;
        }

        // Calculate amplification factor
        float factor = targetPeak / peak;

        return amplify(input, factor);
    }

    // Simple fade in
    std::vector<float> fadeIn(const std::vector<float>& input, int fadeSamples) {
        std::vector<float> output = input;
        int actualFade = std::min(fadeSamples, (int)input.size());

        for (int i = 0; i < actualFade; i++) {
            float factor = (float)i / (float)actualFade;
            output[i] *= factor;
        }

        return output;
    }

    // Simple fade out
    std::vector<float> fadeOut(const std::vector<float>& input, int fadeSamples) {
        std::vector<float> output = input;
        int actualFade = std::min(fadeSamples, (int)input.size());
        int startPos = input.size() - actualFade;

        for (int i = 0; i < actualFade; i++) {
            float factor = 1.0f - ((float)i / (float)actualFade);
            output[startPos + i] *= factor;
        }

        return output;
    }

    // Reverse audio
    std::vector<float> reverse(const std::vector<float>& input) {
        std::vector<float> output(input.size());
        std::reverse_copy(input.begin(), input.end(), output.begin());
        return output;
    }

    // Mix two audio buffers
    std::vector<float> mix(const std::vector<float>& input1,
                          const std::vector<float>& input2,
                          float ratio1 = 0.5f,
                          float ratio2 = 0.5f) {
        size_t size = std::min(input1.size(), input2.size());
        std::vector<float> output(size);

        for (size_t i = 0; i < size; i++) {
            output[i] = std::clamp(
                input1[i] * ratio1 + input2[i] * ratio2,
                -1.0f, 1.0f
            );
        }

        return output;
    }
};

EMSCRIPTEN_BINDINGS(audio_processor) {
    class_<AudioProcessor>("AudioProcessor")
        .constructor<>()
        .function("setSampleRate", &AudioProcessor::setSampleRate)
        .function("setChannels", &AudioProcessor::setChannels)
        .function("amplify", &AudioProcessor::amplify)
        .function("normalize", &AudioProcessor::normalize)
        .function("fadeIn", &AudioProcessor::fadeIn)
        .function("fadeOut", &AudioProcessor::fadeOut)
        .function("reverse", &AudioProcessor::reverse)
        .function("mix", &AudioProcessor::mix);

    register_vector<float>("VectorFloat");
}
