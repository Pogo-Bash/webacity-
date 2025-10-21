#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <vector>
#include <cmath>
#include <algorithm>

using namespace emscripten;

const float PI = 3.14159265358979323846f;

class EffectsProcessor {
private:
    int sampleRate;

public:
    EffectsProcessor() : sampleRate(44100) {}

    void setSampleRate(int rate) {
        sampleRate = rate;
    }

    // Simple low-pass filter (smoothing)
    std::vector<float> lowPassFilter(const std::vector<float>& input, float cutoffFreq) {
        std::vector<float> output(input.size());

        float rc = 1.0f / (cutoffFreq * 2.0f * PI);
        float dt = 1.0f / sampleRate;
        float alpha = dt / (rc + dt);

        output[0] = input[0];
        for (size_t i = 1; i < input.size(); i++) {
            output[i] = output[i-1] + alpha * (input[i] - output[i-1]);
        }

        return output;
    }

    // Simple high-pass filter
    std::vector<float> highPassFilter(const std::vector<float>& input, float cutoffFreq) {
        std::vector<float> output(input.size());

        float rc = 1.0f / (cutoffFreq * 2.0f * PI);
        float dt = 1.0f / sampleRate;
        float alpha = rc / (rc + dt);

        output[0] = input[0];
        for (size_t i = 1; i < input.size(); i++) {
            output[i] = alpha * (output[i-1] + input[i] - input[i-1]);
        }

        return output;
    }

    // Simple compressor
    std::vector<float> compress(const std::vector<float>& input,
                                float threshold,
                                float ratio,
                                float attackTime,
                                float releaseTime) {
        std::vector<float> output(input.size());

        float env = 0.0f;
        float attackCoef = exp(-1.0f / (sampleRate * attackTime));
        float releaseCoef = exp(-1.0f / (sampleRate * releaseTime));

        for (size_t i = 0; i < input.size(); i++) {
            float inputLevel = std::abs(input[i]);

            // Envelope follower
            if (inputLevel > env) {
                env = attackCoef * env + (1.0f - attackCoef) * inputLevel;
            } else {
                env = releaseCoef * env + (1.0f - releaseCoef) * inputLevel;
            }

            // Compression
            float gain = 1.0f;
            if (env > threshold) {
                float excess = env - threshold;
                gain = threshold / env + (excess / env) / ratio;
            }

            output[i] = input[i] * gain;
        }

        return output;
    }

    // Simple delay/echo
    std::vector<float> delay(const std::vector<float>& input,
                            float delayTime,
                            float feedback,
                            float mix) {
        std::vector<float> output = input;
        int delaySamples = static_cast<int>(delayTime * sampleRate);

        if (delaySamples >= (int)input.size()) {
            return output;
        }

        for (size_t i = delaySamples; i < input.size(); i++) {
            float delayed = output[i - delaySamples] * feedback;
            output[i] = input[i] * (1.0f - mix) + (input[i] + delayed) * mix;
        }

        return output;
    }

    // Simple reverb (using multiple delays)
    std::vector<float> reverb(const std::vector<float>& input,
                             float roomSize,
                             float damping,
                             float mix) {
        std::vector<float> output = input;

        // Use multiple delay lines for a simple reverb
        std::vector<int> delayTimes = {
            static_cast<int>(0.037f * sampleRate * roomSize),
            static_cast<int>(0.041f * sampleRate * roomSize),
            static_cast<int>(0.043f * sampleRate * roomSize),
            static_cast<int>(0.047f * sampleRate * roomSize)
        };

        std::vector<std::vector<float>> delayBuffers(4, std::vector<float>(input.size()));

        for (int d = 0; d < 4; d++) {
            int delayTime = delayTimes[d];
            for (size_t i = delayTime; i < input.size(); i++) {
                delayBuffers[d][i] = input[i] + delayBuffers[d][i - delayTime] * damping;
            }
        }

        // Mix all delay lines
        for (size_t i = 0; i < input.size(); i++) {
            float wet = 0.0f;
            for (int d = 0; d < 4; d++) {
                wet += delayBuffers[d][i];
            }
            wet /= 4.0f;
            output[i] = input[i] * (1.0f - mix) + wet * mix;
        }

        return output;
    }

    // Distortion
    std::vector<float> distortion(const std::vector<float>& input, float amount) {
        std::vector<float> output(input.size());

        for (size_t i = 0; i < input.size(); i++) {
            float x = input[i] * amount;
            // Soft clipping using tanh
            output[i] = std::tanh(x);
        }

        return output;
    }
};

EMSCRIPTEN_BINDINGS(effects_processor) {
    class_<EffectsProcessor>("EffectsProcessor")
        .constructor<>()
        .function("setSampleRate", &EffectsProcessor::setSampleRate)
        .function("lowPassFilter", &EffectsProcessor::lowPassFilter)
        .function("highPassFilter", &EffectsProcessor::highPassFilter)
        .function("compress", &EffectsProcessor::compress)
        .function("delay", &EffectsProcessor::delay)
        .function("reverb", &EffectsProcessor::reverb)
        .function("distortion", &EffectsProcessor::distortion);

    register_vector<float>("VectorFloat");
}
